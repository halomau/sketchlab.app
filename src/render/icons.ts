import type { Graphics } from "pixi.js";

/**
 * A drawing surface for an icon, using normalized [0..1] coordinates. Implemented
 * over a PixiJS Graphics (canvas shapes) and over a 2D context (DOM previews), so
 * the same icon definition renders both on the board and in the "/" palette.
 */
export interface IconPen {
  move(x: number, y: number): IconPen;
  line(x: number, y: number): IconPen;
  quad(cx: number, cy: number, x: number, y: number): IconPen;
  bez(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): IconPen;
  circle(cx: number, cy: number, r: number): IconPen;
  ellipse(cx: number, cy: number, rx: number, ry: number): IconPen;
  rrect(x: number, y: number, w: number, h: number, r: number): IconPen;
  poly(pts: number[]): IconPen;
  close(): IconPen;
  stroke(): IconPen;
  fill(): IconPen;
}

/**
 * Icons are drawn with primitive Graphics calls (no fragile SVG path parsing)
 * using normalized [0..1] coordinates mapped onto the shape box. Add an icon by
 * appending to ICONS — it's instantly searchable in the "/" palette.
 */
class Pen implements IconPen {
  constructor(
    private g: Graphics,
    private ox: number,
    private oy: number,
    private size: number,
    private color: number,
  ) {}
  private X(n: number) {
    return this.ox + n * this.size;
  }
  private Y(n: number) {
    return this.oy + n * this.size;
  }
  move(x: number, y: number) {
    this.g.moveTo(this.X(x), this.Y(y));
    return this;
  }
  line(x: number, y: number) {
    this.g.lineTo(this.X(x), this.Y(y));
    return this;
  }
  quad(cx: number, cy: number, x: number, y: number) {
    this.g.quadraticCurveTo(this.X(cx), this.Y(cy), this.X(x), this.Y(y));
    return this;
  }
  bez(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    this.g.bezierCurveTo(
      this.X(c1x),
      this.Y(c1y),
      this.X(c2x),
      this.Y(c2y),
      this.X(x),
      this.Y(y),
    );
    return this;
  }
  circle(cx: number, cy: number, r: number) {
    this.g.circle(this.X(cx), this.Y(cy), r * this.size);
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number) {
    this.g.ellipse(this.X(cx), this.Y(cy), rx * this.size, ry * this.size);
    return this;
  }
  rrect(x: number, y: number, w: number, h: number, r: number) {
    this.g.roundRect(this.X(x), this.Y(y), w * this.size, h * this.size, r * this.size);
    return this;
  }
  poly(pts: number[]) {
    const mapped = pts.map((v, i) => (i % 2 === 0 ? this.X(v) : this.Y(v)));
    this.g.poly(mapped);
    return this;
  }
  close() {
    this.g.closePath();
    return this;
  }
  stroke() {
    this.g.stroke({
      width: this.size * 0.075,
      color: this.color,
      cap: "round",
      join: "round",
    });
    return this;
  }
  fill() {
    this.g.fill(this.color);
    return this;
  }
}

export interface IconDef {
  key: string;
  keywords: string[];
  draw(p: IconPen): void;
}

function polygon(n: number, r: number, cx = 0.5, cy = 0.5, rot = -Math.PI / 2): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

function star(): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.4 : 0.17;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(0.5 + Math.cos(a) * r, 0.52 + Math.sin(a) * r);
  }
  return pts;
}

export const ICONS: IconDef[] = [
  // ---------- compute ----------
  {
    key: "server",
    keywords: ["server", "host", "machine", "rack", "backend", "vps"],
    draw: (p) => {
      p.rrect(0.18, 0.2, 0.64, 0.24, 0.04).stroke();
      p.rrect(0.18, 0.56, 0.64, 0.24, 0.04).stroke();
      p.circle(0.28, 0.32, 0.035).fill();
      p.circle(0.28, 0.68, 0.035).fill();
    },
  },
  {
    key: "container",
    keywords: ["container", "docker", "image", "pod", "crate", "oci"],
    draw: (p) => {
      p.rrect(0.18, 0.3, 0.64, 0.46, 0.02).stroke();
      p.move(0.18, 0.3).line(0.18, 0.26).line(0.82, 0.26).line(0.82, 0.3).stroke();
      p.move(0.34, 0.3).line(0.34, 0.76).stroke();
      p.move(0.5, 0.3).line(0.5, 0.76).stroke();
      p.move(0.66, 0.3).line(0.66, 0.76).stroke();
    },
  },
  {
    key: "kubernetes",
    keywords: ["kubernetes", "k8s", "orchestration", "helm", "cluster", "container"],
    draw: (p) => {
      p.poly(polygon(7, 0.36)).stroke();
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
        p.move(0.5, 0.5).line(0.5 + Math.cos(a) * 0.22, 0.5 + Math.sin(a) * 0.22).stroke();
      }
      p.circle(0.5, 0.5, 0.1).stroke();
    },
  },
  {
    key: "vm",
    keywords: ["vm", "virtual machine", "hypervisor", "instance", "ec2", "vmware", "virtualization"],
    draw: (p) => {
      p.rrect(0.16, 0.2, 0.68, 0.6, 0.05).stroke();
      p.rrect(0.3, 0.34, 0.4, 0.32, 0.04).stroke();
    },
  },
  {
    key: "function",
    keywords: ["function", "lambda", "serverless", "faas", "cloud function", "handler", "edge function"],
    draw: (p) => {
      p.move(0.3, 0.8).line(0.52, 0.3).line(0.74, 0.8).stroke();
      p.move(0.46, 0.44).line(0.36, 0.2).stroke();
    },
  },
  {
    key: "microservice",
    keywords: ["microservice", "service", "node", "hexagon", "component", "module"],
    draw: (p) => {
      p.poly(polygon(6, 0.36)).stroke();
      p.circle(0.5, 0.5, 0.08).stroke();
    },
  },
  {
    key: "cpu",
    keywords: ["cpu", "chip", "processor", "microcontroller", "iot", "hardware", "gpu", "soc", "embedded", "compute"],
    draw: (p) => {
      p.rrect(0.3, 0.3, 0.4, 0.4, 0.03).stroke();
      p.rrect(0.42, 0.42, 0.16, 0.16, 0.02).stroke();
      for (const t of [0.4, 0.5, 0.6]) {
        p.move(t, 0.3).line(t, 0.22).stroke();
        p.move(t, 0.7).line(t, 0.78).stroke();
        p.move(0.3, t).line(0.22, t).stroke();
        p.move(0.7, t).line(0.78, t).stroke();
      }
    },
  },
  {
    key: "memory",
    keywords: ["memory", "ram", "dimm", "dram", "stick"],
    draw: (p) => {
      p.rrect(0.16, 0.36, 0.68, 0.3, 0.02).stroke();
      for (let i = 0; i < 3; i++) p.rrect(0.24 + i * 0.16, 0.42, 0.1, 0.12, 0.01).stroke();
      p.move(0.46, 0.66).line(0.46, 0.72).line(0.54, 0.72).line(0.54, 0.66).stroke();
    },
  },

  // ---------- network ----------
  {
    key: "router",
    keywords: ["router", "network", "gateway", "access point", "modem", "wifi"],
    draw: (p) => {
      p.rrect(0.14, 0.5, 0.72, 0.3, 0.06).stroke();
      p.circle(0.26, 0.65, 0.025).fill();
      p.circle(0.5, 0.65, 0.025).fill();
      p.circle(0.74, 0.65, 0.025).fill();
      p.move(0.34, 0.5).line(0.26, 0.28).stroke();
      p.move(0.66, 0.5).line(0.74, 0.28).stroke();
      p.circle(0.26, 0.25, 0.03).stroke();
      p.circle(0.74, 0.25, 0.03).stroke();
    },
  },
  {
    key: "switch",
    keywords: ["switch", "network", "ports", "ethernet", "hub", "l2"],
    draw: (p) => {
      p.rrect(0.12, 0.36, 0.76, 0.3, 0.05).stroke();
      for (let i = 0; i < 5; i++) p.rrect(0.2 + i * 0.135, 0.54, 0.08, 0.07, 0.01).stroke();
      p.move(0.3, 0.46).line(0.7, 0.46).stroke();
      p.move(0.64, 0.42).line(0.7, 0.46).line(0.64, 0.5).stroke();
    },
  },
  {
    key: "firewall",
    keywords: ["firewall", "security", "wall", "waf", "network", "iptables"],
    draw: (p) => {
      p.rrect(0.16, 0.22, 0.68, 0.56, 0.02).stroke();
      p.move(0.16, 0.41).line(0.84, 0.41).stroke();
      p.move(0.16, 0.59).line(0.84, 0.59).stroke();
      p.move(0.39, 0.22).line(0.39, 0.41).stroke();
      p.move(0.61, 0.22).line(0.61, 0.41).stroke();
      p.move(0.5, 0.41).line(0.5, 0.59).stroke();
      p.move(0.28, 0.41).line(0.28, 0.59).stroke();
      p.move(0.72, 0.41).line(0.72, 0.59).stroke();
      p.move(0.39, 0.59).line(0.39, 0.78).stroke();
      p.move(0.61, 0.59).line(0.61, 0.78).stroke();
    },
  },
  {
    key: "load-balancer",
    keywords: ["load balancer", "lb", "distribution", "nginx", "haproxy", "traffic", "alb", "elb", "balance"],
    draw: (p) => {
      p.move(0.1, 0.5).line(0.28, 0.5).stroke();
      p.circle(0.34, 0.5, 0.06).stroke();
      p.move(0.4, 0.5).line(0.76, 0.26).stroke();
      p.move(0.4, 0.5).line(0.78, 0.5).stroke();
      p.move(0.4, 0.5).line(0.76, 0.74).stroke();
      p.circle(0.82, 0.26, 0.05).stroke();
      p.circle(0.84, 0.5, 0.05).stroke();
      p.circle(0.82, 0.74, 0.05).stroke();
    },
  },
  {
    key: "gateway",
    keywords: ["gateway", "api gateway", "entry", "ingress", "edge", "kong"],
    draw: (p) => {
      p.move(0.28, 0.8).line(0.28, 0.42).stroke();
      p.move(0.72, 0.8).line(0.72, 0.42).stroke();
      p.move(0.28, 0.42).quad(0.5, 0.18, 0.72, 0.42).stroke();
      p.move(0.12, 0.6).line(0.84, 0.6).stroke();
      p.move(0.78, 0.55).line(0.86, 0.6).line(0.78, 0.65).stroke();
    },
  },
  {
    key: "proxy",
    keywords: ["proxy", "reverse proxy", "relay", "forward", "nginx", "sidecar", "envoy"],
    draw: (p) => {
      p.rrect(0.4, 0.4, 0.2, 0.2, 0.03).stroke();
      p.move(0.08, 0.5).line(0.4, 0.5).stroke();
      p.move(0.34, 0.45).line(0.4, 0.5).line(0.34, 0.55).stroke();
      p.move(0.6, 0.5).line(0.92, 0.5).stroke();
      p.move(0.86, 0.45).line(0.92, 0.5).line(0.86, 0.55).stroke();
    },
  },
  {
    key: "dns",
    keywords: ["dns", "nameserver", "route53", "domain", "directory", "resolver", "name resolution"],
    draw: (p) => {
      p.move(0.5, 0.2).line(0.5, 0.82).stroke();
      p.move(0.5, 0.3).line(0.74, 0.3).line(0.8, 0.38).line(0.74, 0.46).line(0.5, 0.46).stroke();
      p.move(0.5, 0.54).line(0.26, 0.54).line(0.2, 0.62).line(0.26, 0.7).line(0.5, 0.7).stroke();
    },
  },
  {
    key: "cdn",
    keywords: ["cdn", "edge", "content delivery", "cloudflare", "fastly", "pop", "distribution"],
    draw: (p) => {
      p.circle(0.5, 0.5, 0.12).stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const x = 0.5 + Math.cos(a) * 0.34;
        const y = 0.5 + Math.sin(a) * 0.34;
        p.move(0.5 + Math.cos(a) * 0.12, 0.5 + Math.sin(a) * 0.12).line(x, y).stroke();
        p.circle(x, y, 0.05).stroke();
      }
    },
  },
  {
    key: "wifi",
    keywords: ["wifi", "wireless", "signal", "network", "connectivity", "hotspot"],
    draw: (p) => {
      p.move(0.24, 0.46).quad(0.5, 0.24, 0.76, 0.46).stroke();
      p.move(0.32, 0.56).quad(0.5, 0.4, 0.68, 0.56).stroke();
      p.move(0.4, 0.66).quad(0.5, 0.56, 0.6, 0.66).stroke();
      p.circle(0.5, 0.74, 0.03).fill();
    },
  },
  {
    key: "network",
    keywords: ["network", "topology", "mesh", "nodes", "lan", "connection", "graph", "distributed"],
    draw: (p) => {
      p.circle(0.5, 0.24, 0.07).stroke();
      p.circle(0.26, 0.7, 0.07).stroke();
      p.circle(0.74, 0.7, 0.07).stroke();
      p.move(0.46, 0.3).line(0.3, 0.64).stroke();
      p.move(0.54, 0.3).line(0.7, 0.64).stroke();
      p.move(0.33, 0.7).line(0.67, 0.7).stroke();
    },
  },
  {
    key: "vpn",
    keywords: ["vpn", "tunnel", "secure connection", "ipsec", "wireguard", "encrypted", "private network"],
    draw: (p) => {
      p.circle(0.22, 0.5, 0.07).stroke();
      p.circle(0.78, 0.5, 0.07).stroke();
      p.move(0.29, 0.5).line(0.4, 0.5).stroke();
      p.move(0.6, 0.5).line(0.71, 0.5).stroke();
      p.rrect(0.42, 0.46, 0.16, 0.16, 0.03).stroke();
      p.move(0.46, 0.46).line(0.46, 0.42).quad(0.5, 0.36, 0.54, 0.42).line(0.54, 0.46).stroke();
    },
  },
  {
    key: "globe",
    keywords: ["globe", "world", "web", "internet", "dns", "public", "earth"],
    draw: (p) => {
      p.circle(0.5, 0.5, 0.34).stroke();
      p.ellipse(0.5, 0.5, 0.16, 0.34).stroke();
      p.move(0.18, 0.5).line(0.82, 0.5).stroke();
    },
  },

  // ---------- data / storage ----------
  {
    key: "database",
    keywords: ["database", "db", "sql", "storage", "data", "postgres", "mysql", "rds"],
    draw: (p) => {
      p.ellipse(0.5, 0.26, 0.3, 0.1).stroke();
      p.move(0.2, 0.26).line(0.2, 0.74).stroke();
      p.move(0.8, 0.26).line(0.8, 0.74).stroke();
      p.ellipse(0.5, 0.74, 0.3, 0.1).stroke();
      p.ellipse(0.5, 0.5, 0.3, 0.1).stroke();
    },
  },
  {
    key: "cache",
    keywords: ["cache", "redis", "memcached", "memory", "fast", "store", "in-memory"],
    draw: (p) => {
      p.rrect(0.2, 0.24, 0.6, 0.52, 0.06).stroke();
      p.poly([0.52, 0.32, 0.4, 0.52, 0.5, 0.52, 0.46, 0.68, 0.6, 0.46, 0.5, 0.46]).fill();
    },
  },
  {
    key: "table",
    keywords: ["table", "schema", "sql", "dataset", "spreadsheet", "grid", "relation", "rows"],
    draw: (p) => {
      p.rrect(0.18, 0.22, 0.64, 0.56, 0.03).stroke();
      p.move(0.18, 0.38).line(0.82, 0.38).stroke();
      p.move(0.18, 0.54).line(0.82, 0.54).stroke();
      p.move(0.4, 0.22).line(0.4, 0.78).stroke();
      p.move(0.6, 0.22).line(0.6, 0.78).stroke();
    },
  },
  {
    key: "bucket",
    keywords: ["bucket", "s3", "object storage", "blob", "gcs", "storage", "pail"],
    draw: (p) => {
      p.ellipse(0.5, 0.3, 0.26, 0.08).stroke();
      p.move(0.24, 0.3).line(0.34, 0.74).stroke();
      p.move(0.76, 0.3).line(0.66, 0.74).stroke();
      p.move(0.34, 0.74).quad(0.5, 0.82, 0.66, 0.74).stroke();
    },
  },
  {
    key: "disk",
    keywords: ["disk", "drive", "hdd", "ssd", "volume", "storage", "ebs", "hard drive"],
    draw: (p) => {
      p.rrect(0.22, 0.22, 0.56, 0.56, 0.06).stroke();
      p.circle(0.5, 0.5, 0.2).stroke();
      p.circle(0.5, 0.5, 0.03).fill();
      p.circle(0.66, 0.66, 0.025).fill();
    },
  },
  {
    key: "archive",
    keywords: ["archive", "backup", "box", "snapshot", "cold storage", "zip", "compress"],
    draw: (p) => {
      p.rrect(0.2, 0.34, 0.6, 0.44, 0.03).stroke();
      p.rrect(0.16, 0.24, 0.68, 0.12, 0.02).stroke();
      p.move(0.42, 0.5).line(0.58, 0.5).stroke();
    },
  },
  {
    key: "file",
    keywords: ["file", "document", "page", "doc", "object"],
    draw: (p) => {
      p.move(0.3, 0.14).line(0.58, 0.14).line(0.74, 0.3).line(0.74, 0.86).line(0.3, 0.86).close().stroke();
      p.move(0.58, 0.14).line(0.58, 0.3).line(0.74, 0.3).stroke();
    },
  },
  {
    key: "folder",
    keywords: ["folder", "directory", "files", "path"],
    draw: (p) => {
      p.move(0.16, 0.76).line(0.16, 0.34).line(0.4, 0.34).line(0.48, 0.44).line(0.84, 0.44).line(0.84, 0.76).close().stroke();
    },
  },

  // ---------- messaging / events ----------
  {
    key: "queue",
    keywords: ["queue", "stack", "layers", "sqs", "list", "buffer", "jobs"],
    draw: (p) => {
      p.rrect(0.2, 0.24, 0.6, 0.12, 0.03).stroke();
      p.rrect(0.2, 0.44, 0.6, 0.12, 0.03).stroke();
      p.rrect(0.2, 0.64, 0.6, 0.12, 0.03).stroke();
    },
  },
  {
    key: "event-bus",
    keywords: ["event bus", "pubsub", "kafka", "topic", "message broker", "sns", "rabbitmq", "events"],
    draw: (p) => {
      p.rrect(0.12, 0.46, 0.76, 0.1, 0.05).stroke();
      p.move(0.28, 0.46).line(0.28, 0.3).stroke();
      p.circle(0.28, 0.26, 0.04).stroke();
      p.move(0.5, 0.56).line(0.5, 0.72).stroke();
      p.circle(0.5, 0.76, 0.04).stroke();
      p.move(0.72, 0.46).line(0.72, 0.3).stroke();
      p.circle(0.72, 0.26, 0.04).stroke();
    },
  },
  {
    key: "stream",
    keywords: ["stream", "streaming", "kinesis", "flow", "realtime", "data flow", "pipeline"],
    draw: (p) => {
      for (const y of [0.38, 0.52, 0.66]) {
        p.move(0.16, y).quad(0.3, y - 0.08, 0.44, y).quad(0.58, y + 0.08, 0.72, y).quad(0.8, y - 0.04, 0.86, y).stroke();
      }
    },
  },
  {
    key: "webhook",
    keywords: ["webhook", "callback", "hook", "http event", "integration", "trigger"],
    draw: (p) => {
      p.circle(0.5, 0.3, 0.09).stroke();
      p.move(0.46, 0.38).line(0.32, 0.62).stroke();
      p.circle(0.3, 0.66, 0.08).stroke();
      p.move(0.55, 0.36).line(0.68, 0.6).stroke();
      p.circle(0.72, 0.64, 0.08).stroke();
      p.move(0.38, 0.66).line(0.64, 0.66).stroke();
    },
  },
  {
    key: "bell",
    keywords: ["notification", "bell", "alert", "alarm", "reminder", "push"],
    draw: (p) => {
      p.circle(0.5, 0.22, 0.035).stroke();
      p.move(0.3, 0.64).line(0.3, 0.46).quad(0.3, 0.28, 0.5, 0.28).quad(0.7, 0.28, 0.7, 0.46).line(0.7, 0.64).stroke();
      p.move(0.24, 0.64).line(0.76, 0.64).stroke();
      p.move(0.44, 0.72).quad(0.5, 0.78, 0.56, 0.72).stroke();
    },
  },
  {
    key: "alert",
    keywords: ["alert", "warning", "error", "incident", "caution", "exception", "pagerduty"],
    draw: (p) => {
      p.poly([0.5, 0.2, 0.84, 0.78, 0.16, 0.78]).stroke();
      p.move(0.5, 0.4).line(0.5, 0.6).stroke();
      p.circle(0.5, 0.68, 0.025).fill();
    },
  },
  {
    key: "chat",
    keywords: ["chat", "message", "comment", "conversation", "slack", "support", "dm"],
    draw: (p) => {
      p.rrect(0.2, 0.26, 0.6, 0.36, 0.06).stroke();
      p.move(0.34, 0.62).line(0.3, 0.76).line(0.46, 0.62).stroke();
      p.circle(0.38, 0.44, 0.025).fill();
      p.circle(0.5, 0.44, 0.025).fill();
      p.circle(0.62, 0.44, 0.025).fill();
    },
  },
  {
    key: "mail",
    keywords: ["mail", "email", "message", "smtp", "inbox", "ses", "sendgrid"],
    draw: (p) => {
      p.rrect(0.16, 0.28, 0.68, 0.44, 0.05).stroke();
      p.move(0.18, 0.32).line(0.5, 0.54).line(0.82, 0.32).stroke();
    },
  },
  {
    key: "feed",
    keywords: ["feed", "rss", "subscribe", "stream", "atom", "news", "updates"],
    draw: (p) => {
      p.circle(0.3, 0.7, 0.05).fill();
      p.move(0.26, 0.46).quad(0.54, 0.46, 0.54, 0.74).stroke();
      p.move(0.26, 0.3).quad(0.7, 0.3, 0.7, 0.74).stroke();
    },
  },

  // ---------- clients / devices ----------
  {
    key: "browser",
    keywords: ["browser", "window", "app", "frontend", "client", "web", "spa"],
    draw: (p) => {
      p.rrect(0.14, 0.2, 0.72, 0.6, 0.05).stroke();
      p.move(0.14, 0.36).line(0.86, 0.36).stroke();
      p.circle(0.21, 0.28, 0.018).fill();
      p.circle(0.28, 0.28, 0.018).fill();
      p.circle(0.35, 0.28, 0.018).fill();
    },
  },
  {
    key: "desktop",
    keywords: ["desktop", "monitor", "screen", "computer", "pc", "workstation", "client", "display"],
    draw: (p) => {
      p.rrect(0.16, 0.22, 0.68, 0.44, 0.04).stroke();
      p.move(0.4, 0.66).line(0.36, 0.78).stroke();
      p.move(0.6, 0.66).line(0.64, 0.78).stroke();
      p.move(0.32, 0.78).line(0.68, 0.78).stroke();
    },
  },
  {
    key: "laptop",
    keywords: ["laptop", "notebook", "macbook", "client", "device", "computer"],
    draw: (p) => {
      p.rrect(0.26, 0.26, 0.48, 0.34, 0.03).stroke();
      p.move(0.16, 0.7).line(0.84, 0.7).stroke();
      p.move(0.26, 0.6).line(0.18, 0.7).stroke();
      p.move(0.74, 0.6).line(0.82, 0.7).stroke();
    },
  },
  {
    key: "phone",
    keywords: ["phone", "mobile", "device", "smartphone", "ios", "android", "client"],
    draw: (p) => {
      p.rrect(0.32, 0.14, 0.36, 0.72, 0.07).stroke();
      p.move(0.45, 0.2).line(0.55, 0.2).stroke();
      p.circle(0.5, 0.78, 0.02).fill();
    },
  },
  {
    key: "tablet",
    keywords: ["tablet", "ipad", "device", "mobile"],
    draw: (p) => {
      p.rrect(0.3, 0.16, 0.4, 0.68, 0.05).stroke();
      p.circle(0.5, 0.76, 0.02).fill();
    },
  },

  // ---------- observability ----------
  {
    key: "gauge",
    keywords: ["gauge", "monitoring", "metrics", "performance", "speed", "apm", "observability", "prometheus"],
    draw: (p) => {
      p.move(0.16, 0.64).quad(0.16, 0.28, 0.5, 0.28).quad(0.84, 0.28, 0.84, 0.64).stroke();
      p.move(0.5, 0.62).line(0.66, 0.4).stroke();
      p.circle(0.5, 0.62, 0.03).fill();
    },
  },
  {
    key: "chart",
    keywords: ["chart", "analytics", "metrics", "bar chart", "report", "dashboard", "bi", "stats"],
    draw: (p) => {
      p.move(0.2, 0.2).line(0.2, 0.8).line(0.82, 0.8).stroke();
      p.rrect(0.3, 0.54, 0.1, 0.24, 0.01).stroke();
      p.rrect(0.46, 0.4, 0.1, 0.38, 0.01).stroke();
      p.rrect(0.62, 0.5, 0.1, 0.28, 0.01).stroke();
    },
  },
  {
    key: "logs",
    keywords: ["logs", "logging", "console", "output", "stdout", "audit", "events", "kibana"],
    draw: (p) => {
      p.rrect(0.2, 0.2, 0.6, 0.6, 0.05).stroke();
      p.move(0.3, 0.36).line(0.7, 0.36).stroke();
      p.move(0.3, 0.48).line(0.64, 0.48).stroke();
      p.move(0.3, 0.6).line(0.7, 0.6).stroke();
      p.move(0.3, 0.72).line(0.58, 0.72).stroke();
    },
  },
  {
    key: "dashboard",
    keywords: ["dashboard", "grafana", "panel", "monitoring", "admin", "ui", "overview"],
    draw: (p) => {
      p.rrect(0.16, 0.2, 0.68, 0.6, 0.05).stroke();
      p.move(0.5, 0.2).line(0.5, 0.8).stroke();
      p.move(0.16, 0.5).line(0.5, 0.5).stroke();
      p.move(0.6, 0.44).line(0.6, 0.34).stroke();
      p.move(0.68, 0.44).line(0.68, 0.3).stroke();
      p.move(0.76, 0.44).line(0.76, 0.38).stroke();
    },
  },

  // ---------- devops ----------
  {
    key: "git",
    keywords: ["git", "branch", "version control", "vcs", "commit", "merge", "github", "gitlab"],
    draw: (p) => {
      p.move(0.34, 0.29).line(0.34, 0.71).stroke();
      p.circle(0.34, 0.22, 0.07).stroke();
      p.circle(0.34, 0.78, 0.07).stroke();
      p.move(0.34, 0.5).quad(0.5, 0.5, 0.62, 0.4).quad(0.66, 0.36, 0.66, 0.29).stroke();
      p.circle(0.66, 0.22, 0.07).stroke();
    },
  },
  {
    key: "repo",
    keywords: ["repo", "repository", "book", "library", "docs", "codebase", "package"],
    draw: (p) => {
      p.rrect(0.26, 0.18, 0.48, 0.64, 0.03).stroke();
      p.move(0.36, 0.18).line(0.36, 0.82).stroke();
      p.move(0.44, 0.34).line(0.66, 0.34).stroke();
      p.move(0.44, 0.46).line(0.66, 0.46).stroke();
    },
  },
  {
    key: "pipeline",
    keywords: ["pipeline", "ci", "cd", "cicd", "build", "deploy", "workflow", "jenkins", "actions", "stages"],
    draw: (p) => {
      p.circle(0.22, 0.5, 0.08).stroke();
      p.circle(0.5, 0.5, 0.08).stroke();
      p.circle(0.78, 0.5, 0.08).stroke();
      p.move(0.3, 0.5).line(0.42, 0.5).stroke();
      p.move(0.38, 0.46).line(0.42, 0.5).line(0.38, 0.54).stroke();
      p.move(0.58, 0.5).line(0.7, 0.5).stroke();
      p.move(0.66, 0.46).line(0.7, 0.5).line(0.66, 0.54).stroke();
    },
  },
  {
    key: "package",
    keywords: ["package", "module", "cube", "artifact", "npm", "dependency", "box", "registry", "bundle"],
    draw: (p) => {
      p.poly([0.5, 0.16, 0.82, 0.34, 0.82, 0.66, 0.5, 0.84, 0.18, 0.66, 0.18, 0.34]).stroke();
      p.move(0.18, 0.34).line(0.5, 0.5).line(0.82, 0.34).stroke();
      p.move(0.5, 0.5).line(0.5, 0.84).stroke();
    },
  },
  {
    key: "terminal",
    keywords: ["terminal", "cli", "console", "shell", "bash", "command", "prompt"],
    draw: (p) => {
      p.rrect(0.16, 0.22, 0.68, 0.56, 0.05).stroke();
      p.move(0.28, 0.4).line(0.4, 0.5).line(0.28, 0.6).stroke();
      p.move(0.46, 0.6).line(0.62, 0.6).stroke();
    },
  },
  {
    key: "code",
    keywords: ["code", "api", "json", "brackets", "dev", "rest", "graphql", "sdk"],
    draw: (p) => {
      p.move(0.36, 0.3).line(0.2, 0.5).line(0.36, 0.7).stroke();
      p.move(0.64, 0.3).line(0.8, 0.5).line(0.64, 0.7).stroke();
      p.move(0.56, 0.26).line(0.44, 0.74).stroke();
    },
  },
  {
    key: "gear",
    keywords: ["gear", "settings", "config", "cog", "service", "worker", "engine", "process"],
    draw: (p) => {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const c = Math.cos(a);
        const s = Math.sin(a);
        p.move(0.5 + c * 0.3, 0.5 + s * 0.3).line(0.5 + c * 0.42, 0.5 + s * 0.42).stroke();
      }
      p.circle(0.5, 0.5, 0.28).stroke();
      p.circle(0.5, 0.5, 0.12).stroke();
    },
  },
  {
    key: "rocket",
    keywords: ["rocket", "deploy", "launch", "release", "ship", "startup", "boost", "production"],
    draw: (p) => {
      p.move(0.5, 0.18).quad(0.68, 0.36, 0.66, 0.62).line(0.34, 0.62).quad(0.32, 0.36, 0.5, 0.18).close().stroke();
      p.circle(0.5, 0.4, 0.06).stroke();
      p.move(0.34, 0.56).line(0.24, 0.72).line(0.4, 0.64).stroke();
      p.move(0.66, 0.56).line(0.76, 0.72).line(0.6, 0.64).stroke();
      p.move(0.44, 0.66).line(0.5, 0.82).line(0.56, 0.66).stroke();
    },
  },
  {
    key: "bug",
    keywords: ["bug", "issue", "defect", "debug", "error", "ticket", "jira"],
    draw: (p) => {
      p.ellipse(0.5, 0.56, 0.16, 0.2).stroke();
      p.circle(0.5, 0.32, 0.08).stroke();
      p.move(0.5, 0.36).line(0.5, 0.76).stroke();
      p.move(0.34, 0.48).line(0.22, 0.42).stroke();
      p.move(0.34, 0.58).line(0.2, 0.58).stroke();
      p.move(0.34, 0.68).line(0.22, 0.74).stroke();
      p.move(0.66, 0.48).line(0.78, 0.42).stroke();
      p.move(0.66, 0.58).line(0.8, 0.58).stroke();
      p.move(0.66, 0.68).line(0.78, 0.74).stroke();
      p.move(0.44, 0.27).line(0.38, 0.19).stroke();
      p.move(0.56, 0.27).line(0.62, 0.19).stroke();
    },
  },

  // ---------- ai / data ----------
  {
    key: "bot",
    keywords: ["bot", "robot", "ai", "agent", "assistant", "chatbot", "llm", "automation"],
    draw: (p) => {
      p.rrect(0.26, 0.34, 0.48, 0.4, 0.06).stroke();
      p.circle(0.4, 0.52, 0.04).fill();
      p.circle(0.6, 0.52, 0.04).fill();
      p.move(0.5, 0.34).line(0.5, 0.24).stroke();
      p.circle(0.5, 0.21, 0.03).stroke();
      p.move(0.26, 0.5).line(0.2, 0.5).stroke();
      p.move(0.74, 0.5).line(0.8, 0.5).stroke();
      p.move(0.44, 0.64).line(0.56, 0.64).stroke();
    },
  },
  {
    key: "neural",
    keywords: ["neural network", "model", "ml", "ai", "deep learning", "inference", "tensorflow", "pytorch", "embedding"],
    draw: (p) => {
      const L1 = [0.34, 0.66];
      const L2 = [0.28, 0.5, 0.72];
      const L3 = [0.4, 0.6];
      for (const a of L1) for (const b of L2) p.move(0.27, a).line(0.47, b).stroke();
      for (const b of L2) for (const c of L3) p.move(0.53, b).line(0.73, c).stroke();
      for (const a of L1) p.circle(0.24, a, 0.045).stroke();
      for (const b of L2) p.circle(0.5, b, 0.045).stroke();
      for (const c of L3) p.circle(0.76, c, 0.045).stroke();
    },
  },
  {
    key: "search",
    keywords: ["search", "find", "query", "elasticsearch", "lookup", "index", "magnify", "explore", "opensearch"],
    draw: (p) => {
      p.circle(0.44, 0.44, 0.2).stroke();
      p.move(0.58, 0.58).line(0.78, 0.78).stroke();
    },
  },

  // ---------- security ----------
  {
    key: "lock",
    keywords: ["lock", "secure", "auth", "security", "ssl", "private", "encrypted"],
    draw: (p) => {
      p.rrect(0.28, 0.46, 0.44, 0.36, 0.05).stroke();
      p.move(0.36, 0.46).line(0.36, 0.36).quad(0.5, 0.22, 0.64, 0.36).line(0.64, 0.46).stroke();
      p.circle(0.5, 0.62, 0.045).fill();
    },
  },
  {
    key: "key",
    keywords: ["key", "auth", "secret", "credential", "api key", "token", "password", "access", "encryption"],
    draw: (p) => {
      p.circle(0.34, 0.4, 0.13).stroke();
      p.move(0.43, 0.49).line(0.74, 0.8).stroke();
      p.move(0.62, 0.68).line(0.7, 0.6).stroke();
      p.move(0.7, 0.76).line(0.78, 0.68).stroke();
    },
  },
  {
    key: "shield",
    keywords: ["shield", "security", "protection", "waf", "defense", "secure", "guard", "trust"],
    draw: (p) => {
      p.move(0.5, 0.18).line(0.78, 0.3).line(0.78, 0.52).quad(0.78, 0.74, 0.5, 0.84).quad(0.22, 0.74, 0.22, 0.52).line(0.22, 0.3).close().stroke();
      p.move(0.38, 0.5).line(0.47, 0.6).line(0.64, 0.4).stroke();
    },
  },
  {
    key: "vault",
    keywords: ["vault", "safe", "secrets", "kms", "secret manager", "security", "keystore", "hashicorp"],
    draw: (p) => {
      p.rrect(0.2, 0.22, 0.6, 0.56, 0.04).stroke();
      p.circle(0.46, 0.5, 0.16).stroke();
      p.move(0.46, 0.5).line(0.46, 0.36).stroke();
      p.move(0.46, 0.5).line(0.58, 0.5).stroke();
      p.move(0.7, 0.4).line(0.7, 0.6).stroke();
    },
  },
  {
    key: "certificate",
    keywords: ["certificate", "cert", "ssl", "tls", "x509", "badge", "signed", "ca"],
    draw: (p) => {
      p.rrect(0.2, 0.2, 0.6, 0.44, 0.03).stroke();
      p.move(0.3, 0.32).line(0.7, 0.32).stroke();
      p.move(0.3, 0.42).line(0.6, 0.42).stroke();
      p.circle(0.5, 0.62, 0.1).stroke();
      p.move(0.44, 0.7).line(0.4, 0.84).line(0.5, 0.78).line(0.6, 0.84).line(0.56, 0.7).stroke();
    },
  },
  {
    key: "fingerprint",
    keywords: ["fingerprint", "biometric", "auth", "identity", "touch id", "scan"],
    draw: (p) => {
      p.move(0.3, 0.6).quad(0.3, 0.34, 0.5, 0.32).quad(0.7, 0.34, 0.7, 0.6).stroke();
      p.move(0.38, 0.62).quad(0.38, 0.44, 0.5, 0.42).quad(0.62, 0.44, 0.62, 0.62).stroke();
      p.move(0.46, 0.64).quad(0.46, 0.54, 0.5, 0.52).quad(0.54, 0.54, 0.54, 0.64).stroke();
      p.move(0.5, 0.66).line(0.5, 0.72).stroke();
    },
  },

  // ---------- identity / people ----------
  {
    key: "user",
    keywords: ["user", "person", "account", "profile", "customer"],
    draw: (p) => {
      p.circle(0.5, 0.36, 0.16).stroke();
      p.move(0.22, 0.84).quad(0.5, 0.54, 0.78, 0.84).stroke();
    },
  },
  {
    key: "users",
    keywords: ["users", "team", "group", "people", "audience", "org"],
    draw: (p) => {
      p.circle(0.4, 0.36, 0.14).stroke();
      p.move(0.16, 0.82).quad(0.4, 0.54, 0.64, 0.82).stroke();
      p.circle(0.68, 0.34, 0.1).stroke();
      p.move(0.62, 0.66).quad(0.78, 0.5, 0.88, 0.72).stroke();
    },
  },
  {
    key: "id-badge",
    keywords: ["id", "badge", "identity", "user", "profile", "sso", "account", "employee", "auth"],
    draw: (p) => {
      p.rrect(0.24, 0.18, 0.52, 0.64, 0.05).stroke();
      p.move(0.42, 0.18).line(0.42, 0.26).line(0.58, 0.26).line(0.58, 0.18).stroke();
      p.circle(0.5, 0.42, 0.09).stroke();
      p.move(0.36, 0.62).line(0.64, 0.62).stroke();
      p.move(0.4, 0.7).line(0.6, 0.7).stroke();
    },
  },

  // ---------- generic / flow ----------
  {
    key: "cloud",
    keywords: ["cloud", "saas", "internet", "aws", "gcp", "azure", "hosting"],
    draw: (p) => {
      p.move(0.26, 0.68)
        .quad(0.12, 0.68, 0.16, 0.54)
        .quad(0.18, 0.42, 0.32, 0.44)
        .quad(0.36, 0.28, 0.56, 0.32)
        .quad(0.72, 0.34, 0.72, 0.5)
        .quad(0.88, 0.5, 0.84, 0.64)
        .quad(0.82, 0.68, 0.74, 0.68)
        .close()
        .stroke();
    },
  },
  {
    key: "datacenter",
    keywords: ["datacenter", "building", "on prem", "facility", "region", "office", "company", "headquarters"],
    draw: (p) => {
      p.rrect(0.24, 0.22, 0.52, 0.6, 0.02).stroke();
      for (const r of [0.32, 0.46, 0.6]) for (const c of [0.36, 0.56]) p.rrect(c, r, 0.1, 0.08, 0.01).stroke();
      p.rrect(0.42, 0.72, 0.16, 0.1, 0.01).stroke();
    },
  },
  {
    key: "location",
    keywords: ["location", "pin", "region", "zone", "datacenter", "geo", "map", "availability zone", "marker"],
    draw: (p) => {
      p.move(0.5, 0.82).quad(0.26, 0.56, 0.26, 0.42).quad(0.26, 0.2, 0.5, 0.2).quad(0.74, 0.2, 0.74, 0.42).quad(0.74, 0.56, 0.5, 0.82).stroke();
      p.circle(0.5, 0.42, 0.08).stroke();
    },
  },
  {
    key: "calendar",
    keywords: ["calendar", "schedule", "date", "events", "cron", "booking", "timeline"],
    draw: (p) => {
      p.rrect(0.2, 0.26, 0.6, 0.54, 0.04).stroke();
      p.move(0.2, 0.4).line(0.8, 0.4).stroke();
      p.move(0.34, 0.2).line(0.34, 0.32).stroke();
      p.move(0.66, 0.2).line(0.66, 0.32).stroke();
      p.circle(0.36, 0.54, 0.02).fill();
      p.circle(0.5, 0.54, 0.02).fill();
      p.circle(0.64, 0.54, 0.02).fill();
      p.circle(0.36, 0.66, 0.02).fill();
      p.circle(0.5, 0.66, 0.02).fill();
    },
  },
  {
    key: "clock",
    keywords: ["clock", "time", "schedule", "cron", "timer", "scheduler", "latency"],
    draw: (p) => {
      p.circle(0.5, 0.5, 0.36).stroke();
      p.move(0.5, 0.5).line(0.5, 0.28).stroke();
      p.move(0.5, 0.5).line(0.66, 0.58).stroke();
    },
  },
  {
    key: "sync",
    keywords: ["sync", "refresh", "replication", "retry", "loop", "reload", "mirror", "update"],
    draw: (p) => {
      p.move(0.3, 0.36).quad(0.5, 0.2, 0.7, 0.34).stroke();
      p.move(0.7, 0.22).line(0.72, 0.36).line(0.58, 0.36).stroke();
      p.move(0.7, 0.64).quad(0.5, 0.8, 0.3, 0.66).stroke();
      p.move(0.3, 0.78).line(0.28, 0.64).line(0.42, 0.64).stroke();
    },
  },
  {
    key: "upload",
    keywords: ["upload", "deploy", "push", "import", "publish", "release", "send", "ingest"],
    draw: (p) => {
      p.move(0.3, 0.74).line(0.7, 0.74).stroke();
      p.move(0.5, 0.66).line(0.5, 0.28).stroke();
      p.move(0.38, 0.4).line(0.5, 0.28).line(0.62, 0.4).stroke();
    },
  },
  {
    key: "download",
    keywords: ["download", "pull", "export", "fetch", "save", "receive", "backup"],
    draw: (p) => {
      p.move(0.3, 0.74).line(0.7, 0.74).stroke();
      p.move(0.5, 0.28).line(0.5, 0.62).stroke();
      p.move(0.38, 0.5).line(0.5, 0.62).line(0.62, 0.5).stroke();
    },
  },
  {
    key: "link",
    keywords: ["link", "url", "hyperlink", "connection", "reference", "chain", "integration", "endpoint"],
    draw: (p) => {
      p.rrect(0.24, 0.4, 0.28, 0.2, 0.1).stroke();
      p.rrect(0.48, 0.4, 0.28, 0.2, 0.1).stroke();
      p.move(0.4, 0.5).line(0.6, 0.5).stroke();
    },
  },
  {
    key: "tag",
    keywords: ["tag", "label", "metadata", "version", "release", "sku", "price"],
    draw: (p) => {
      p.move(0.22, 0.28).line(0.56, 0.28).line(0.8, 0.52).line(0.56, 0.76).line(0.22, 0.76).close().stroke();
      p.circle(0.34, 0.52, 0.05).stroke();
    },
  },
  {
    key: "flag",
    keywords: ["flag", "feature flag", "milestone", "marker", "goal", "toggle", "launchdarkly"],
    draw: (p) => {
      p.move(0.3, 0.18).line(0.3, 0.82).stroke();
      p.move(0.3, 0.24).line(0.72, 0.24).line(0.62, 0.38).line(0.72, 0.52).line(0.3, 0.52).stroke();
    },
  },
  {
    key: "toggle",
    keywords: ["toggle", "switch", "feature flag", "setting", "boolean", "on off", "enable"],
    draw: (p) => {
      p.rrect(0.22, 0.4, 0.56, 0.2, 0.1).stroke();
      p.circle(0.64, 0.5, 0.08).fill();
    },
  },
  {
    key: "filter",
    keywords: ["filter", "funnel", "query", "where", "refine", "sort"],
    draw: (p) => {
      p.move(0.22, 0.26).line(0.78, 0.26).line(0.56, 0.5).line(0.56, 0.74).line(0.44, 0.66).line(0.44, 0.5).close().stroke();
    },
  },
  {
    key: "workflow",
    keywords: ["workflow", "flowchart", "process", "dag", "orchestration", "step functions", "automation"],
    draw: (p) => {
      p.rrect(0.18, 0.2, 0.26, 0.2, 0.03).stroke();
      p.rrect(0.56, 0.6, 0.26, 0.2, 0.03).stroke();
      p.move(0.31, 0.4).line(0.31, 0.7).line(0.56, 0.7).stroke();
      p.move(0.5, 0.66).line(0.56, 0.7).line(0.5, 0.74).stroke();
    },
  },
  {
    key: "decision",
    keywords: ["decision", "condition", "branch", "if", "gateway", "diamond", "choice"],
    draw: (p) => {
      p.poly([0.5, 0.2, 0.8, 0.5, 0.5, 0.8, 0.2, 0.5]).stroke();
    },
  },
  {
    key: "bolt",
    keywords: ["bolt", "lightning", "power", "energy", "fast", "event", "trigger"],
    draw: (p) => {
      p.poly([0.56, 0.12, 0.3, 0.54, 0.48, 0.54, 0.44, 0.88, 0.72, 0.44, 0.52, 0.44]).fill();
    },
  },
  {
    key: "check",
    keywords: ["check", "done", "success", "ok", "complete", "healthy", "passed"],
    draw: (p) => {
      p.move(0.2, 0.54).line(0.42, 0.74).line(0.8, 0.28).stroke();
    },
  },
  {
    key: "star",
    keywords: ["star", "favorite", "bookmark", "featured"],
    draw: (p) => {
      p.poly(star()).fill();
    },
  },
  {
    key: "heart",
    keywords: ["heart", "like", "love", "health"],
    draw: (p) => {
      p.move(0.5, 0.8).bez(0.08, 0.52, 0.2, 0.16, 0.5, 0.38).bez(0.8, 0.16, 0.92, 0.52, 0.5, 0.8).fill();
    },
  },
];

export const ICON_MAP = new Map(ICONS.map((i) => [i.key, i]));

/** Every icon, alphabetized by key — the default browse order in the "/" palette. */
export const ICONS_SORTED = [...ICONS].sort((a, b) => a.key.localeCompare(b.key));

export function searchIcons(query: string): IconDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICONS_SORTED;
  const scored = ICONS.map((icon) => {
    let score = -1;
    if (icon.key === q) score = 100;
    else if (icon.key.startsWith(q)) score = 80;
    else if (icon.key.includes(q)) score = 60;
    for (const k of icon.keywords) {
      if (k === q) score = Math.max(score, 90);
      else if (k.startsWith(q)) score = Math.max(score, 55);
      else if (k.includes(q)) score = Math.max(score, 32);
    }
    return { icon, score };
  }).filter((s) => s.score >= 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.icon);
}

export function drawIcon(
  g: Graphics,
  key: string,
  ox: number,
  oy: number,
  size: number,
  color: number,
): void {
  const def = ICON_MAP.get(key);
  if (!def) return;
  def.draw(new Pen(g, ox, oy, size, color));
}

/** Draws an icon onto a 2D canvas context — used for DOM previews in the "/" palette. */
class CanvasPen implements IconPen {
  private begun = false;
  constructor(
    private ctx: CanvasRenderingContext2D,
    private ox: number,
    private oy: number,
    private size: number,
    private color: string,
  ) {}
  private X(n: number) {
    return this.ox + n * this.size;
  }
  private Y(n: number) {
    return this.oy + n * this.size;
  }
  /** PixiJS starts a fresh sub-path per shape+draw; mirror that on the 2D context. */
  private begin() {
    if (!this.begun) {
      this.ctx.beginPath();
      this.begun = true;
    }
  }
  move(x: number, y: number) {
    this.begin();
    this.ctx.moveTo(this.X(x), this.Y(y));
    return this;
  }
  line(x: number, y: number) {
    this.begin();
    this.ctx.lineTo(this.X(x), this.Y(y));
    return this;
  }
  quad(cx: number, cy: number, x: number, y: number) {
    this.begin();
    this.ctx.quadraticCurveTo(this.X(cx), this.Y(cy), this.X(x), this.Y(y));
    return this;
  }
  bez(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    this.begin();
    this.ctx.bezierCurveTo(this.X(c1x), this.Y(c1y), this.X(c2x), this.Y(c2y), this.X(x), this.Y(y));
    return this;
  }
  circle(cx: number, cy: number, r: number) {
    this.begin();
    const rr = r * this.size;
    // moveTo the arc start so it isn't joined to the previous sub-path by a line
    this.ctx.moveTo(this.X(cx) + rr, this.Y(cy));
    this.ctx.arc(this.X(cx), this.Y(cy), rr, 0, Math.PI * 2);
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number) {
    this.begin();
    const rxx = rx * this.size;
    const ryy = ry * this.size;
    this.ctx.moveTo(this.X(cx) + rxx, this.Y(cy));
    this.ctx.ellipse(this.X(cx), this.Y(cy), rxx, ryy, 0, 0, Math.PI * 2);
    return this;
  }
  rrect(x: number, y: number, w: number, h: number, r: number) {
    this.begin();
    this.ctx.roundRect(this.X(x), this.Y(y), w * this.size, h * this.size, r * this.size);
    return this;
  }
  poly(pts: number[]) {
    this.begin();
    for (let i = 0; i < pts.length; i += 2) {
      const px = this.X(pts[i]);
      const py = this.Y(pts[i + 1]);
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    return this;
  }
  close() {
    this.ctx.closePath();
    return this;
  }
  stroke() {
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = Math.max(1, this.size * 0.075);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.stroke();
    this.begun = false;
    return this;
  }
  fill() {
    this.ctx.fillStyle = this.color;
    this.ctx.fill();
    this.begun = false;
    return this;
  }
}

/** Render an icon into a 2D canvas context (for DOM previews). */
export function renderIconToContext(
  key: string,
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  size: number,
  color: string,
): void {
  const def = ICON_MAP.get(key);
  if (!def) return;
  def.draw(new CanvasPen(ctx, ox, oy, size, color));
}
