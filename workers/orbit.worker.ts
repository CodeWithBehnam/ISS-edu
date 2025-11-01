/**
 * Web Worker for orbit computations (pass predictions, track sampling).
 * Keeps heavy SGP4 calculations off the main thread.
 */

import { computePasses, type ObserverLocation, type Pass } from '../lib/lib/passes';
import {
  sampleOrbitTrack,
  breakTrackAtIdl,
} from '../lib/lib/propagation';

export type WorkerRequest =
  | {
      type: 'COMPUTE_PASSES';
      observer: ObserverLocation;
      windowHours: number;
      tle: string;
    }
  | {
      type: 'PROPAGATE_TRACK';
      start: number; // Unix timestamp (ms)
      end: number; // Unix timestamp (ms)
      stepSec: number;
      tle: string;
    };

export type WorkerResponse =
  | { type: 'PASSES'; passes: Pass[] }
  | { type: 'TRACK'; segments: Array<Array<{ t: number; lat: number; lon: number }>> }
  | { type: 'ERROR'; error: string };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    if (request.type === 'COMPUTE_PASSES') {
      const passes = computePasses(
        request.tle,
        request.observer,
        request.windowHours,
        10 // max passes
      );

      const response: WorkerResponse = { type: 'PASSES', passes };
      self.postMessage(response);
    } else if (request.type === 'PROPAGATE_TRACK') {
      const start = new Date(request.start);
      const end = new Date(request.end);
      const points = sampleOrbitTrack(request.tle, start, end, request.stepSec);
      const segments = breakTrackAtIdl(points);

      const response: WorkerResponse = {
        type: 'TRACK',
        segments: segments.map((segment) =>
          segment.map((p) => ({
            t: p.time.getTime(),
            lat: p.position.latitude,
            lon: p.position.longitude,
          }))
        ),
      };
      self.postMessage(response);
    }
  } catch (error) {
    const response: WorkerResponse = {
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    self.postMessage(response);
  }
};
