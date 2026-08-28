const config = {
  "*.{js,jsx,ts,tsx,mjs,cjs}": [
    "biome check --write --no-errors-on-unmatched",
    "eslint --fix",
  ],
  "*.{json,jsonc,css,md}": "biome check --write --no-errors-on-unmatched",
}

export default config
