const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('builderspace_token');
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
}

export const apiService = new ApiService();