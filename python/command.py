#!/usr/bin/env python3

import json
import ipaddress
import re
import subprocess
import sys

from pathlib import Path


# Project configuration
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

RULES_FILE = DATA_DIR / "firewall-rules.json"
INTERFACES_FILE = DATA_DIR / "interfaces.json"

IPTABLES = "/usr/sbin/iptables"

FLOATING_CHAIN = "NETWALL_FLOATING"
INPUT_CHAIN = "NETWALL_INPUT"
FORWARD_CHAIN = "NETWALL_FORWARD"


def run_iptables(args, check=True):
    return subprocess.run(
        [IPTABLES] + args,
        capture_output=True,
        text=True,
        check=check
    )


def load_json(file):
    with open(file, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_network(value):
    if not value:
        return True

    try:
        ipaddress.ip_network(value, strict=False)
        return True
    except ValueError:
        return False


def validate_port(value):
    if value == "":
        return True

    try:
        port = int(value)
        return 1 <= port <= 65535
    except (ValueError, TypeError):
        return False


def validate_rule(rule, valid_interfaces):
    if rule.get("interface") not in valid_interfaces:
        raise ValueError("Invalid logical interface")

    if rule.get("action") not in ["ACCEPT", "DROP", "REJECT"]:
        raise ValueError("Invalid action")

    if rule.get("protocol") not in ["tcp", "udp", "icmp", "all"]:
        raise ValueError("Invalid protocol")

    if not validate_network(rule.get("source", "")):
        raise ValueError("Invalid source network")

    if not validate_network(rule.get("destination", "")):
        raise ValueError("Invalid destination network")

    source_port = rule.get("sourcePort", "")
    destination_port = rule.get("destinationPort", "")

    if not validate_port(source_port):
        raise ValueError("Invalid source port")

    if not validate_port(destination_port):
        raise ValueError("Invalid destination port")

    if (source_port or destination_port) and rule["protocol"] not in ["tcp", "udp"]:
        raise ValueError("Ports require TCP or UDP")

    if rule.get("gateway"):
        raise ValueError("Gateway policy routing is not implemented yet")

    if not isinstance(rule.get("enabled"), bool):
        raise ValueError("Invalid rule status")

    if not re.fullmatch(r"[a-fA-F0-9-]{1,64}", str(rule.get("id", ""))):
        raise ValueError("Invalid rule ID")


def build_rule(rule):
    args = []

    protocol = rule["protocol"]

    if protocol != "all":
        args.extend(["-p", protocol])

    if rule.get("source"):
        args.extend(["-s", rule["source"]])

    if rule.get("sourcePort"):
        args.extend(["--sport", str(rule["sourcePort"])])

    if rule.get("destination"):
        args.extend(["-d", rule["destination"]])

    if rule.get("destinationPort"):
        args.extend(["--dport", str(rule["destinationPort"])])

    args.extend([
        "-m", "comment",
        "--comment", "netwall:" + rule["id"],
        "-j", rule["action"]
    ])

    return args


def get_existing_chains():
    result = run_iptables(["-S"])

    chains = []

    for line in result.stdout.splitlines():
        parts = line.split()

        if len(parts) >= 2 and parts[0] == "-N":
            chains.append(parts[1])

    return chains


def ensure_chain(chain):
    run_iptables(["-N", chain], check=False)
    run_iptables(["-F", chain])


def remove_jump(parent, child):
    while True:
        result = run_iptables(
            ["-D", parent, "-j", child],
            check=False
        )

        if result.returncode != 0:
            break


def apply_rules():
    rules_data = load_json(RULES_FILE)
    interfaces_data = load_json(INTERFACES_FILE)

    rules = rules_data.get("rules")
    interfaces = interfaces_data.get("interfaces")

    if not isinstance(rules, list) or not isinstance(interfaces, list):
        raise ValueError("Invalid configuration structure")

    interface_map = {}

    for item in interfaces:
        interface_id = item.get("id")
        nic = item.get("nic", "")

        if not isinstance(interface_id, str):
            raise ValueError("Invalid interface ID")

        if not re.fullmatch(r"WAN|LAN|OPT[1-9]\d*", interface_id):
            raise ValueError("Invalid interface ID")

        if nic:
            if not re.fullmatch(r"[A-Za-z0-9_.:-]{1,15}", nic):
                raise ValueError("Invalid network interface name")

        interface_map[interface_id] = nic

    valid_interfaces = set(interface_map.keys())
    valid_interfaces.add("FLOATING")

    # Validate every rule before changing iptables
    for rule in rules:
        validate_rule(rule, valid_interfaces)

    # Gateway is not silently ignored
    for rule in rules:
        if rule.get("enabled") and rule.get("gateway"):
            raise ValueError("Cannot apply rules with an unsupported gateway")

    # Prepare chain names
    interface_chains = {
        interface_id: "NETWALL_IF_" + interface_id
        for interface_id in interface_map
    }

    desired_chains = {
        FLOATING_CHAIN,
        INPUT_CHAIN,
        FORWARD_CHAIN,
        *interface_chains.values()
    }

    # Create and flush main chains
    ensure_chain(INPUT_CHAIN)
    ensure_chain(FORWARD_CHAIN)
    ensure_chain(FLOATING_CHAIN)

    # Disconnect old interface chains from our hook chains
    run_iptables(["-F", INPUT_CHAIN])
    run_iptables(["-F", FORWARD_CHAIN])

    # Remove obsolete NetWall interface chains
    for chain in get_existing_chains():
        if chain.startswith("NETWALL_IF_") and chain not in desired_chains:
            run_iptables(["-F", chain])
            run_iptables(["-X", chain])

    # Create and flush current interface chains
    for chain in interface_chains.values():
        ensure_chain(chain)

    # Apply Floating Rules
    for rule in rules:
        if rule["interface"] != "FLOATING":
            continue

        if not rule["enabled"]:
            continue

        run_iptables([
            "-A",
            FLOATING_CHAIN,
            *build_rule(rule)
        ])

    run_iptables(["-A", FLOATING_CHAIN, "-j", "RETURN"])

    # Apply interface-specific rules
    for interface_id, nic in interface_map.items():
        if not nic:
            continue

        chain = interface_chains[interface_id]

        for rule in rules:
            if rule["interface"] != interface_id:
                continue

            if not rule["enabled"]:
                continue

            run_iptables([
                "-A",
                chain,
                *build_rule(rule)
            ])

        run_iptables(["-A", chain, "-j", "RETURN"])

        # Match traffic entering through this NIC
        run_iptables([
            "-A", INPUT_CHAIN,
            "-i", nic,
            "-j", chain
        ])

        run_iptables([
            "-A", FORWARD_CHAIN,
            "-i", nic,
            "-j", chain
        ])

    # Floating rules are evaluated before interface rules
    run_iptables([
        "-I", INPUT_CHAIN, "1",
        "-j", FLOATING_CHAIN
    ])

    run_iptables([
        "-I", FORWARD_CHAIN, "1",
        "-j", FLOATING_CHAIN
    ])

    # Attach NetWall hooks to existing filter chains
    for parent, child in [
        ("INPUT", INPUT_CHAIN),
        ("FORWARD", FORWARD_CHAIN)
    ]:
        remove_jump(parent, child)

        run_iptables([
            "-I", parent, "1",
            "-j", child
        ])

    print("NetWall firewall rules applied successfully.")


if __name__ == "__main__":
    try:
        apply_rules()

    except Exception as error:
        print(f"Firewall error: {error}", file=sys.stderr)
        sys.exit(1)