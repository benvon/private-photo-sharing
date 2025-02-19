private-photo-sharing/
├── frontend/
│   ├── wasm/              # Go WebAssembly code
│   ├── static/            # Static assets
│   │   ├── css/
│   │   ├── js/
│   │   └── index.html
│   └── go.mod
├── worker/                # Cloudflare Worker code
│   ├── src/
│   │   ├── handlers/
│   │   ├── models/
│   │   └── utils/
│   ├── package.json
│   └── wrangler.toml
└── README.md 