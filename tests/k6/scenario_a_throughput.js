// Local Chapter 7 load test. Set K6_TOKEN and a unique RUN_ID via environment.
import { submitAndObserve } from './chapter7_common.js';

export const options = {
  scenarios: { throughput: { executor: 'shared-iterations', vus: Number(__ENV.VUS || 20),
    iterations: Number(__ENV.ITERATIONS || 100), maxDuration: __ENV.MAX_DURATION || '10m' } },
};

export default submitAndObserve;
