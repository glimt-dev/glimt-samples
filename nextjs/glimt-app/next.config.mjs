import { dirname } from "path";
import { fileURLToPath } from "url";

const nextConfig = {
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;

