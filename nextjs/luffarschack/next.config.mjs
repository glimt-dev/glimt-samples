import { dirname } from "path";
import { fileURLToPath } from "url";

const nextConfig = {
  productionBrowserSourceMaps: true,
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;

