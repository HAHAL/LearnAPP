import updateProgress from "./updateProgress.js";

export default {
  async fetch(request) {
    return updateProgress.fetch(request);
  }
};
