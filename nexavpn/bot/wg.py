import os, subprocess

IFACE = os.getenv("WG_IFACE", "wg0")
ENDPOINT = os.getenv("WG_ENDPOINT", "")          # IP или домен сервера
PORT = os.getenv("WG_PORT", "51820")
SUBNET = os.getenv("WG_SUBNET", "10.8.0")        # клиенты: 10.8.0.2 ... 10.8.0.254
DNS = os.getenv("WG_DNS", "1.1.1.1, 1.0.0.1")


def _run(*a, inp=None):
    return subprocess.run(a, input=inp, capture_output=True, text=True, check=True).stdout.strip()


def gen_keys():
    priv = _run("wg", "genkey")
    return priv, _run("wg", "pubkey", inp=priv + "\n")


def server_pub():
    return _run("wg", "show", IFACE, "public-key")


def free_ip(used):
    for i in range(2, 255):
        ip = f"{SUBNET}.{i}"
        if ip not in used:
            return ip
    raise RuntimeError("Нет свободных адресов в подсети")


def add_peer(pub, ip):
    _run("wg", "set", IFACE, "peer", pub, "allowed-ips", f"{ip}/32")
    _run("wg-quick", "save", IFACE)


def remove_peer(pub):
    try:
        _run("wg", "set", IFACE, "peer", pub, "remove")
        _run("wg-quick", "save", IFACE)
    except subprocess.CalledProcessError:
        pass


def client_conf(priv, ip):
    return (
        "[Interface]\n"
        f"PrivateKey = {priv}\n"
        f"Address = {ip}/32\n"
        f"DNS = {DNS}\n\n"
        "[Peer]\n"
        f"PublicKey = {server_pub()}\n"
        f"Endpoint = {ENDPOINT}:{PORT}\n"
        "AllowedIPs = 0.0.0.0/0, ::/0\n"
        "PersistentKeepalive = 25\n"
    )
