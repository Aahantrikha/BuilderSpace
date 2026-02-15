// Automatically detect the correct API URL based on current host
const getApiBaseUrl = () => {
  // If VITE_API_URL is set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // If accessing from network (not localhost), use the same host for API
  const currentHost = window.location.hostname;
  if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
    return `http://${currentHost}:3001/api`;
  }
  
  // Default to localhost
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

class ApiService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('kaivan_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth endpoints
  async signup(data: { name: string; email: string; password: string }) {
    return this.request<{
      message: string;
      user: any;
      accessToken: string;
    }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{
      message: string;
      user: any;
      accessToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async googleAuth(token: string) {
    return this.request<{
      message: string;
      user: any;
      accessToken: string;
    }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async logout() {
    return this.request<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser() {
    return this.request<{ user: any }>('/auth/me');
  }

  async updateProfile(data: any) {
    return this.request<{
      message: string;
      user: any;
    }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Startups endpoints
  async getStartups(params?: {
    search?: string;
    stage?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.stage) searchParams.append('stage', params.stage);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const query = searchParams.toString();
    return this.request<{ startups: any[] }>(`/startups${query ? `?${query}` : ''}`);
  }

  async getStartup(id: string) {
    return this.request<{ startup: any; hasApplied: boolean }>(`/startups/${id}`);
  }

  async createStartup(data: {
    name: string;
    description: string;
    stage: string;
    skillsNeeded?: string[];
  }) {
    return this.request<{
      message: string;
      startup: any;
    }>('/startups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Hackathons endpoints
  async getHackathons(params?: {
    search?: string;
    upcoming?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.upcoming) searchParams.append('upcoming', 'true');
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());

    const query = searchParams.toString();
    return this.request<{ hackathons: any[] }>(`/hackathons${query ? `?${query}` : ''}`);
  }

  async getHackathon(id: string) {
    return this.request<{ hackathon: any; hasApplied: boolean }>(`/hackathons/${id}`);
  }

  async createHackathon(data: {
    name: string;
    description: string;
    teamSize: number;
    deadline: Date;
    skillsNeeded?: string[];
  }) {
    return this.request<{
      message: string;
      hackathon: any;
    }>('/hackathons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Applications endpoints
  async applyToPost(data: {
    postType: 'startup' | 'hackathon';
    postId: string;
    message: string;
  }) {
    return this.request<{
      message: string;
      application: any;
    }>('/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyApplications() {
    return this.request<{ applications: any[] }>('/applications/my');
  }

  async getReceivedApplications() {
    return this.request<{ applications: any[] }>('/applications/received');
  }

  async updateApplicationStatus(id: string, status: 'accepted' | 'rejected') {
    return this.request<{
      message: string;
      application: any;
    }>(`/applications/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Get user's own startups
  async getMyStartups() {
    return this.request<{ startups: any[] }>('/startups/my');
  }

  // Get user's own hackathons
  async getMyHackathons() {
    return this.request<{ hackathons: any[] }>('/hackathons/my');
  }

  // Screening Chats endpoints
  async getMyScreeningChats() {
    return this.request<{ screeningChats: any[] }>('/screening-chats');
  }

  async getScreeningChat(chatId: string) {
    return this.request<{ screeningChat: any }>(`/screening-chats/${chatId}`);
  }

  async getScreeningMessages(chatId: string) {
    return this.request<{ messages: any[] }>(`/screening-chats/${chatId}/messages`);
  }

  async sendScreeningMessage(chatId: string, content: string) {
    return this.request<{ message: any }>(`/screening-chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Workspaces endpoints
  async getMyWorkspaces() {
    return this.request<{ spaces: any[] }>('/builder-spaces/my');
  }

  async createWorkspace(data: { name: string; description?: string }) {
    return this.request<{ workspace: any }>('/builder-spaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWorkspace(workspaceId: string) {
    return this.request<{ space: any }>(`/builder-spaces/${workspaceId}`);
  }

  async getWorkspaceMessages(workspaceId: string) {
    return this.request<{ messages: any[] }>(`/builder-spaces/${workspaceId}/messages`);
  }

  async sendWorkspaceMessage(workspaceId: string, content: string) {
    return this.request<{ data: any }>(`/builder-spaces/${workspaceId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async getWorkspaceLinks(workspaceId: string) {
    return this.request<{ links: any[] }>(`/builder-spaces/${workspaceId}/links`);
  }

  async addWorkspaceLink(workspaceId: string, data: { title: string; url: string; description?: string }) {
    return this.request<{ link: any }>(`/builder-spaces/${workspaceId}/links`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWorkspaceTasks(workspaceId: string) {
    return this.request<{ tasks: any[] }>(`/builder-spaces/${workspaceId}/tasks`);
  }

  async createWorkspaceTask(workspaceId: string, data: { title: string; description?: string }) {
    return this.request<{ task: any }>(`/builder-spaces/${workspaceId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkspaceTask(workspaceId: string, taskId: string, data: { completed: boolean }) {
    return this.request<{ task: any }>(`/builder-spaces/${workspaceId}/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async inviteToWorkspace(workspaceId: string, email: string) {
    return this.request<{ message: string; user: any }>(`/builder-spaces/${workspaceId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async getWorkspaceMembers(workspaceId: string) {
    return this.request<{ members: any[]; isFounder: boolean }>(`/builder-spaces/${workspaceId}/members`);
  }

  async removeMemberFromWorkspace(workspaceId: string, memberId: string) {
    return this.request<{ message: string }>(`/builder-spaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  // Stats endpoints
  async getStats() {
    return this.request<{ stats: { users: number; startups: number; hackathons: number; applications: number } }>('/stats');
  }

  // Delete methods
  async deleteStartup(startupId: string) {
    return this.request<{ message: string }>(`/startups/${startupId}`, {
      method: 'DELETE',
    });
  }

  async deleteHackathon(hackathonId: string) {
    return this.request<{ message: string }>(`/hackathons/${hackathonId}`, {
      method: 'DELETE',
    });
  }

  async deleteWorkspace(workspaceId: string) {
    return this.request<{ message: string }>(`/builder-spaces/${workspaceId}`, {
      method: 'DELETE',
    });
  }
}

export const apiService = new ApiService();