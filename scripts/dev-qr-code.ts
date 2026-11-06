// Vite plugin for `npm run dev:ar`: prints a QR code of the AR preview's network
// address after Vite's own URL list, so a phone can open it directly.
import { networkInterfaces } from "node:os";
import { encode } from "uqr";

// Interfaces a phone can't reach, or usually isn't on: VPN tunnels, containers,
// virtual machines. They stay in the list of other addresses, just not first.
const UNLIKELY_INTERFACE = /^(utun|tun|tap|ppp|ipsec|wg|docker|br-|veth|vmnet|vboxnet|vEthernet|virbr|awdl|llw|bridge|Tailscale|ZeroTier)/i;

function interfaceOf(ip: string): string {
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (addresses?.some((address) => address.address === ip)) return name;
  }
  return "";
}

/** Sort network URLs by how likely a phone in the same network can reach them. */
export function rankNetworkUrls(urls: string[], nameOf: (ip: string) => string = interfaceOf): string[] {
  const score = (url: string) => {
    const ip = new URL(url).hostname;
    if (ip.startsWith("169.254.")) return 3; // self-assigned, no real network
    if (UNLIKELY_INTERFACE.test(nameOf(ip))) return 2;
    return ip.startsWith("192.168.") ? 0 : 1;
  };
  return [...urls].sort((a, b) => score(a) - score(b));
}

/**
 * Two QR rows per text line, using half blocks. Colours are set explicitly (black
 * on white): the terminal's own colours would invert the code on a dark theme,
 * and many phone cameras can't read an inverted code.
 */
export function renderQr(text: string): string {
  const { data } = encode(text, { border: 4, ecc: "L" });
  const lines: string[] = [];
  for (let y = 0; y < data.length; y += 2) {
    let line = "";
    for (let x = 0; x < data[y].length; x++) {
      const top = data[y][x];
      const bottom = data[y + 1]?.[x] ?? false;
      line += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
    }
    lines.push(`  \x1b[30;107m${line}\x1b[0m`);
  }
  return lines.join("\n");
}

export function devQrCode(path = "ar.html") {
  return {
    name: "dev-qr-code",
    apply: "serve" as const,
    configureServer(server: any) {
      const printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        printUrls();
        const [best, ...others] = rankNetworkUrls(server.resolvedUrls?.network ?? []);
        if (!best) {
          console.log("\n  No network address found, so no QR code: is this computer on a network?\n");
          return;
        }
        const url = new URL(path, best).href;
        console.log(`\n  Open on your phone (same Wi-Fi): ${url}\n\n${renderQr(url)}\n`);
        if (others.length) {
          console.log(`  If the phone can't reach it, try: ${others.map((o) => new URL(path, o).href).join("  ")}\n`);
        }
      };
    }
  };
}
