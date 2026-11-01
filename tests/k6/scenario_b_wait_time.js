// Queue wait is derived from ASSIGNED and createdAt/REQUEUED in submission history.
import { submitAndObserve } from './chapter7_common.js';

export const options = {
  scenarios: { wait_time: { executor: 'shared-iterations', vus: Number(__ENV.VUS || 20),
    iterations: Number(__ENV.ITERATIONS || 20), maxDuration: __ENV.MAX_DURATION || '10m' } },
};

export default submitAndObserve;
