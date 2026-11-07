#!/usr/bin/env python3
"""Apply NetWall's IPv4 filter rules using dedicated iptables chains."""

import ipaddress
import json
import re
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RULES_FILE = DATA_DIR / "firewall-rules.json"
INTERFACES_FILE = DATA_DIR / "interfaces.json"
IPTABLES = "/usr/sbin/iptables"

FLOATING_CHAIN = "NETWALL_FLOATING"
INPUT_CHAIN = "NETWALL_INPUT"
FORWARD_CHAIN = "NETWALL_FORWARD"


def run_iptables(args, check=True):
    """Use argv (never a shell) and wait for the xtables lock."""
    return subprocess.run(
        [IPTABLES, "-w", "5"] + args,
        capture_output=True,
        text=True,
        check=check,
    )


def load_json(file_path):
    with open(file_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_network(value):
    if value == "":
        return True
    try:
        network = ipaddress.ip_network(value, strict=False)
        return network.version == 4
    except (ValueError, TypeError):
        return False


def validate_port(value):
    if value == "":
        return True
    try:
        port = int(value)
        return 1 <= port <= 65535
    except (ValueError, TypeError):
        return False


def validate_rule(rule, interface_map):
    if not isinstance(rule, dict):
        raise ValueError("Invalid firewall rule entry")

    interface_id = rule.get("interface")
    if interface_id == "FLOATING":
        pass
    elif interface_id not in interface_map:
        raise ValueError("Invalid logical interface in firewall rule")
    elif not interface_map[interface_id]:
        raise ValueError(f"{interface_id} has no assigned network interface")

    if rule.get("action") not in ["ACCEPT", "DROP", "REJECT"]:
        raise ValueError("Invalid firewall action")
    if rule.get("protocol") not in ["tcp", "udp", "icmp", "all"]:
        raise ValueError("Invalid firewall protocol")
    if not validate_network(rule.get("source", "")):
        raise ValueError("Invalid source IPv4 network")
    if not validate_network(rule.get("destination", "")):
        raise ValueError("Invalid destination IPv4 network")

    source_port = rule.get("sourcePort", "")
    destination_port = rule.get("destinationPort", "")
    if not validate_port(source_port) or not validate_port(destination_port):
        raise ValueError("Invalid source or destination port")
    if (source_port or destination_port) and rule["protocol"] not in ["tcp", "udp"]:
        raise ValueError("Ports require TCP or UDP")
    if rule.get("gateway"):
        raise ValueError("Gateway policy routing is not implemented")
    if not isinstance(rule.get("enabled"), bool):
        raise ValueError("Invalid rule status")
    if not re.fullmatch(r"[a-fA-F0-9-]{1,64}", str(rule.get("id", ""))):
        raise ValueError("Invalid rule ID")
    if not isinstance(rule.get("position"), int) or rule["position"] < 1:
        raise ValueError("Invalid rule position")


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
        "-m", "comment", "--comment", "netwall:" + rule["id"],
        "-j", rule["action"],
    ])
    return args


def get_existing_chains():
    result = run_iptables(["-S"])
    return [
        parts[1]
        for line in result.stdout.splitlines()
        if len(parts := line.split()) >= 2 and parts[0] == "-N"
    ]


def ensure_chain(chain):
    run_iptables(["-N", chain], check=False)
    run_iptables(["-F", chain])


def remove_jump(parent, child):
    while True:
        result = run_iptables(["-D", parent, "-j", child], check=False)
        if result.returncode != 0:
            break


def apply_rules():
    rules_data = load_json(RULES_FILE)
    interfaces_data = load_json(INTERFACES_FILE)
    rules = rules_data.get("rules") if isinstance(rules_data, dict) else None
    interfaces = interfaces_data.get("interfaces") if isinstance(interfaces_data, dict) else None
    if not isinstance(rules, list) or not isinstance(interfaces, list):
        raise ValueError("Invalid configuration structure")

    interface_map = {}
    used_nics = set()
    for item in interfaces:
        if not isinstance(item, dict):
            raise ValueError("Invalid interface assignment")
        interface_id = item.get("id")
        nic = item.get("nic", "")
        if not isinstance(interface_id, str) or not re.fullmatch(r"WAN|LAN|OPT[1-9]\d*", interface_id):
            raise ValueError("Invalid logical interface ID")
        if interface_id in interface_map:
            raise ValueError("Duplicate logical interface ID")
        if not isinstance(nic, str):
            raise ValueError("Invalid network interface name")
        if nic:
            if not re.fullmatch(r"[A-Za-z0-9_.:-]{1,15}", nic):
                raise ValueError("Invalid network interface name")
            if nic in used_nics:
                raise ValueError(f"Network interface {nic} is assigned more than once")
            used_nics.add(nic)
        interface_map[interface_id] = nic

    # Validate all configuration before touching the running firewall.
    rule_ids = set()
    positions = set()
    for rule in rules:
        validate_rule(rule, interface_map)
        if rule["id"] in rule_ids:
            raise ValueError("Duplicate firewall rule ID")
        if rule["position"] in positions:
            raise ValueError("Duplicate firewall rule position")
        rule_ids.add(rule["id"])
        positions.add(rule["position"])

    ordered_rules = sorted(rules, key=lambda item: item["position"])
    interface_chains = {
        interface_id: "NETWALL_IF_" + interface_id
        for interface_id in interface_map
    }
    desired_chains = {
        FLOATING_CHAIN, INPUT_CHAIN, FORWARD_CHAIN, *interface_chains.values()
    }

    ensure_chain(INPUT_CHAIN)
    ensure_chain(FORWARD_CHAIN)
    ensure_chain(FLOATING_CHAIN)

    for chain in get_existing_chains():
        if chain.startswith("NETWALL_IF_") and chain not in desired_chains:
            run_iptables(["-F", chain])
            run_iptables(["-X", chain])

    for chain in interface_chains.values():
        ensure_chain(chain)

    for rule in ordered_rules:
        if rule["interface"] == "FLOATING" and rule["enabled"]:
            run_iptables(["-A", FLOATING_CHAIN, *build_rule(rule)])
    run_iptables(["-A", FLOATING_CHAIN, "-j", "RETURN"])

    for interface_id, nic in interface_map.items():
        if not nic:
            continue
        chain = interface_chains[interface_id]
        for rule in ordered_rules:
            if rule["interface"] == interface_id and rule["enabled"]:
                run_iptables(["-A", chain, *build_rule(rule)])
        run_iptables(["-A", chain, "-j", "RETURN"])
        run_iptables(["-A", INPUT_CHAIN, "-i", nic, "-j", chain])
        run_iptables(["-A", FORWARD_CHAIN, "-i", nic, "-j", chain])

    # Floating rules run before rules belonging to a specific interface.
    run_iptables(["-I", INPUT_CHAIN, "1", "-j", FLOATING_CHAIN])
    run_iptables(["-I", FORWARD_CHAIN, "1", "-j", FLOATING_CHAIN])

    for parent, child in [("INPUT", INPUT_CHAIN), ("FORWARD", FORWARD_CHAIN)]:
        remove_jump(parent, child)
        run_iptables(["-I", parent, "1", "-j", child])

    print("NetWall firewall rules applied successfully.")


if __name__ == "__main__":
    try:
        apply_rules()
    except Exception as error:
        print(f"Firewall error: {error}", file=sys.stderr)
        sys.exit(1)
