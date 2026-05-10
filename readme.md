
```markdown
# Vasuki iTech Core SDK
> **Infrastructure that stays invisible.** The unified developer toolkit for the Vasuki Cloud ecosystem.

[![Status](https://img.shields.io/badge/Status-Stable-success?style=flat-square)]()
[![Documentation](https://img.shields.io/badge/Docs-Workspace_Style-blue?style=flat-square)]()

---

## 🛠 Features
*   **Guppt Integration:** Secure, India-optimized database management.
*   **Argon OS Connect:** Seamless task and document coordination.
*   **Unified Auth:** One integration for the entire ecosystem (Vypaar, Forms, Vaimanika AI).
*   **Zero-DevOps:** Deploy and scale without environment mismatches.

## Quick Start

### 1. Installation
```bash
npm install @vasuki/core

```

### 2. Authentication

Set your namespace handle and API key retrieved from your [Vasuki Dashboard](https://www.google.com/search?q=https://vasuki.cloud).

```javascript
const vasuki = require('@vasuki/core');

vasuki.initialize({
  namespace: 'your-handle',
  apiKey: 'vsk_live_...'
});

```

### 3. Usage (Guppt Storage Example)

```javascript
// Store assets with unlimited lifetime storage
const storage = vasuki.storage('guppt');

await storage.upload('app-backend-assets', fileBuffer, {
  permissions: 'read-execute'
});

```

---

## 📖 Documentation

Detailed guides are available in the [Docs](https://www.google.com/search?q=./docs) folder:

* [API Reference](https://www.google.com/search?q=./docs/api.md)
* [Argon OS Integration](https://www.google.com/search?q=./docs/argon.md)
* [Security Protocols](https://www.google.com/search?q=./docs/security.md)

## 🤝 Contributing

We welcome builders. Please read our [Contribution Guidelines](https://www.google.com/search?q=CONTRIBUTING.md) before submitting a PR.

---

© 2026 Vasuki iTech. Independent cloud infrastructure.

