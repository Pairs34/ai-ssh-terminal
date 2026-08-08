const OUI_TABLE: Record<string, string> = {
  "00:1A:1E": "Aruba Networks",
  "6C:F3:7F": "Aruba Networks",
  "00:09:0F": "Fortinet",
  "70:4C:A5": "Fortinet",
  "00:1B:D5": "Cisco",
  "00:0C:29": "VMware",
  "00:50:56": "VMware",
  "B8:27:EB": "Raspberry Pi Foundation",
  "DC:A6:32": "Raspberry Pi Foundation",
  "00:15:5D": "Microsoft Hyper-V",
  "00:16:3E": "Xen",
  "F4:5C:89": "Ubiquiti",
  "24:A4:3C": "Ubiquiti",
  "00:E0:4C": "Realtek"
};

export function guessVendorFromMac(mac: string | null): string | null {
  if (!mac) return null;
  const prefix = mac.toUpperCase().slice(0, 8);
  return OUI_TABLE[prefix] ?? null;
}
