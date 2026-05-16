import { listRecords } from "./procedures/list-records";
import { getRecord } from "./procedures/get-record";
import { retryRecord } from "./procedures/retry-record";

export const meetingRecordsRouter = {
  list: listRecords,
  get: getRecord,
  retry: retryRecord,
};
