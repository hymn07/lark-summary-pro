import { listMembers, addMember, removeMember, updateMemberModels } from "./procedures/members";
import { listProviders, createProvider, deleteProvider } from "./procedures/model-providers";
import { getSystemConfig, updateSystemConfig } from "./procedures/system-config";
import { getDefaultPrompt, setDefaultPrompt } from "./procedures/default-prompt";
import { testPipeline } from "./procedures/test-pipeline";

export const adminMeetingRouter = {
  members: {
    list: listMembers,
    add: addMember,
    remove: removeMember,
    updateModels: updateMemberModels,
  },
  modelProviders: {
    list: listProviders,
    create: createProvider,
    delete: deleteProvider,
  },
  settings: {
    get: getSystemConfig,
    update: updateSystemConfig,
  },
  prompt: {
    getDefault: getDefaultPrompt,
    setDefault: setDefaultPrompt,
  },
  test: {
    pipeline: testPipeline,
  },
};
