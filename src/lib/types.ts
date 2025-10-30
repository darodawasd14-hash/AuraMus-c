export interface Song { 
  id: string;
  videoId: string; // Made non-optional
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
  timestamp?: any;
  artwork?: string;
  duration?: number;
}

export type ActiveView = 'discover' | 'playlist' | 'friends';
