// 200 VU submit 1000 total requests. This does not imply 1000 concurrent submissions.
import { submitAndObserve } from './chapter7_common.js';

export const options = {
  scenarios: { thousand: { executor: 'shared-iterations', vus: Number(__ENV.VUS || 200),
    iterations: Number(__ENV.ITERATIONS || 1000), maxDuration: __ENV.MAX_DURATION || '15m' } },
};

export default submitAndObserve;
