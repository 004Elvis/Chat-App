export interface MediaItem {
  messageId: number;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  senderUserName: string;
  sentAt: string;
}

export interface LinkItem {
  messageId: number;
  url: string;
  messageContent: string;
  senderUserName: string;
  sentAt: string;
}

export interface RoomMedia {
  images: MediaItem[];
  videos: MediaItem[];
  documents: MediaItem[];
  links: LinkItem[];
}