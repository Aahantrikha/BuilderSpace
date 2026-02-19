// Stub file - actual implementation in SharedLinkService.ts.bak
export class SharedLinkService {
  async addSharedLink(data: any) {
    throw new Error('SharedLinkService not implemented');
  }
  async getSharedLinks(spaceId: string, userId: string) {
    throw new Error('SharedLinkService not implemented');
  }
  async removeSharedLink(linkId: string, userId: string) {
    throw new Error('SharedLinkService not implemented');
  }
}

export const sharedLinkService = new SharedLinkService();
