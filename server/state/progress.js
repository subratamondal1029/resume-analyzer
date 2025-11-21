import { EventEmitter } from "events";

export const progresses = {
  //   id: {
  //     status: "Started Analyzing...",
  //     progress: 10,
  //     emitter: EventEmitter instance
  //     data: {...} // at the end of analysis the data will be stored here
  //   },
  // ......
};

export function createProgress(id) {
  progresses[id] = {
    status: "Starting analysis...",
    progress: 0,
    emitter: new EventEmitter(),
    data: null,
  };
  return progresses[id];
}

export function updateProgress(id, status, progress, data = null) {
  const progressEntry = progresses[id];
  if (progressEntry) {
    progressEntry.status = status;
    progressEntry.progress = progress;
    progressEntry.data = data;
    progressEntry.emitter.emit("progress", { status, progress, data });
  }
}

export function deleteProgress(id) {
  if (progresses[id]) {
    progresses[id].emitter.removeAllListeners();
    delete progresses[id];
  }
}
