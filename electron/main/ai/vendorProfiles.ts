export interface VendorCommand {
  key: string;
  description: string;
  command: string;
  readOnly: boolean;
  riskLevel: "low" | "medium" | "high";
}

export const VENDOR_COMMANDS: Record<string, VendorCommand[]> = {
  switch: [
    { key: "port_status", description: "Port durumunu kontrol et", command: "show interfaces status", readOnly: true, riskLevel: "low" },
    { key: "port_errors", description: "Port hata sayaçları", command: "show interfaces counters errors", readOnly: true, riskLevel: "low" },
    { key: "vlan_list", description: "VLAN listesi", command: "show vlan brief", readOnly: true, riskLevel: "low" },
    { key: "mac_table", description: "MAC adres tablosu", command: "show mac address-table", readOnly: true, riskLevel: "low" },
    { key: "lldp_neighbors", description: "LLDP komşuları", command: "show lldp neighbors", readOnly: true, riskLevel: "low" },
    { key: "cpu_mem", description: "CPU/bellek durumu", command: "show processes cpu | include CPU", readOnly: true, riskLevel: "low" },
    { key: "set_port_description", description: "Port açıklamasını değiştir", command: "interface {port}\\n description {desc}", readOnly: false, riskLevel: "low" },
    { key: "set_port_shutdown", description: "Portu kapat", command: "interface {port}\\n shutdown", readOnly: false, riskLevel: "medium" },
    { key: "set_access_vlan", description: "Access VLAN değiştir", command: "interface {port}\\n switchport access vlan {vlan}", readOnly: false, riskLevel: "medium" }
  ],
  firewall: [
    { key: "interface_status", description: "Interface durumu", command: "get system interface", readOnly: true, riskLevel: "low" },
    { key: "ha_status", description: "HA durumu", command: "get system ha status", readOnly: true, riskLevel: "low" },
    { key: "routing_table", description: "Routing tablosu", command: "get router info routing-table all", readOnly: true, riskLevel: "low" },
    { key: "sdwan_status", description: "SD-WAN durumu", command: "diagnose sys sdwan health-check status", readOnly: true, riskLevel: "low" },
    { key: "resources", description: "Sistem kaynakları", command: "get system performance status", readOnly: true, riskLevel: "low" },
    { key: "critical_logs", description: "Kritik loglar", command: "execute log filter category 0\\nexecute log display", readOnly: true, riskLevel: "low" }
  ],
  linux_server: [
    { key: "disk_usage", description: "Disk kullanımı", command: "df -h", readOnly: true, riskLevel: "low" },
    { key: "mem_usage", description: "Bellek kullanımı", command: "free -h", readOnly: true, riskLevel: "low" },
    { key: "service_status", description: "Servis durumu", command: "systemctl status {service}", readOnly: true, riskLevel: "low" },
    { key: "net_interfaces", description: "Ağ arayüzleri", command: "ip addr show", readOnly: true, riskLevel: "low" },
    { key: "routing_table", description: "Routing tablosu", command: "ip route show", readOnly: true, riskLevel: "low" },
    { key: "recent_errors", description: "Son sistem hataları", command: "journalctl -p err -n 50 --no-pager", readOnly: true, riskLevel: "low" },
    { key: "restart_service", description: "Servisi yeniden başlat", command: "systemctl restart {service}", readOnly: false, riskLevel: "high" }
  ]
};

export function getCommandsForDeviceType(deviceType: string): VendorCommand[] {
  return VENDOR_COMMANDS[deviceType] ?? [];
}
