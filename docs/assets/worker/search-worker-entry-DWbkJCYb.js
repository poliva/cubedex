import {
  nodeEndpointPort
} from "./chunk-VXVRV477.js";
import {
  exposeAPI
} from "./chunk-7GUL3OBQ.js";
import "./chunk-RDSQRW3G.js";
import "./chunk-YLS2ZYML.js";

// src/cubing/search/worker-workarounds/search-worker-entry.js
if (exposeAPI.expose) {
  (async () => {
    await import("./inside-CVVS4HLC.js");
    const messagePort = globalThis.postMessage ? globalThis : await nodeEndpointPort();
    messagePort.postMessage("comlink-exposed");
  })();
}
var WORKER_ENTRY_FILE_URL = import.meta.url;
export {
  WORKER_ENTRY_FILE_URL
};
//# sourceMappingURL=search-worker-entry.js.map
