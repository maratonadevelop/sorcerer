// Force IPv4 DNS resolution BEFORE any network modules are imported
// This fixes ENETUNREACH errors on platforms like Render that have IPv6 connectivity issues
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
