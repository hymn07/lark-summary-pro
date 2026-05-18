import { listRecords } from "./procedures/list-records";
import { getRecord } from "./procedures/get-record";
import { retryRecord } from "./procedures/retry-record";
import { listFeishuMeetings, getFeishuMeetingDetail, createManualMeeting, generateForMeeting } from "./procedures/search-meetings";

export const meetingRecordsRouter = {
  list: listRecords,
  get: getRecord,
  retry: retryRecord,
  feishuList: listFeishuMeetings,
  feishuDetail: getFeishuMeetingDetail,
  createManual: createManualMeeting,
  generate: generateForMeeting,
};
