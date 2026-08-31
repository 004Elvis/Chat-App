import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatRoom } from '../models/chat-room.model';
import { Message } from '../models/message.model';
import { RoomMedia } from '../models/room-media.model';
import { environment } from '../../../environments/environment';
import { GroupKeyResponse, GroupKeyVersionInfo } from '../models/group-key.model';
import { CallLog } from '../models/call.model';

export interface AttachmentUploadResult {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  messageType: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly API = `${environment.apiUrl}/chatrooms`;

  constructor(private http: HttpClient) {}

  getMyRooms(): Observable<ChatRoom[]> {
    return this.http.get<ChatRoom[]>(this.API);
  }

  getRoom(id: number): Observable<ChatRoom> {
    return this.http.get<ChatRoom>(`${this.API}/${id}`);
  }

  createRoom(name: string, isGroup: boolean,
    memberIds: string[]): Observable<ChatRoom> {
    return this.http.post<ChatRoom>(this.API, {
      name, isGroup, memberIds
    });
  }

  startDirectMessage(userId: string): Observable<ChatRoom> {
    return this.http.post<ChatRoom>(`${this.API}/direct`, { userId });
  }

  removeMember(roomId: number, userId: string): Observable<any> {
    return this.http.delete(`${this.API}/${roomId}/members/${userId}`);
  }

  promoteToAdmin(roomId: number, userId: string): Observable<any> {
    return this.http.post(`${this.API}/${roomId}/members/${userId}/promote`, {});
  }

  leaveRoom(roomId: number): Observable<any> {
    return this.http.post(`${this.API}/${roomId}/leave`, {});
  }

  deleteRoom(roomId: number): Observable<any> {
    return this.http.delete(`${this.API}/${roomId}`);
  }

  getMessages(roomId: number,
    cursor?: number): Observable<Message[]> {
    const params = cursor ? `?cursor=${cursor}&limit=50` : '?limit=50';
    return this.http.get<Message[]>(
      `${this.API}/${roomId}/messages${params}`
    );
  }

  uploadAttachment(roomId: number, file: File): Observable<HttpEvent<AttachmentUploadResult>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<AttachmentUploadResult>(
      `${this.API}/${roomId}/attachments`,
      formData,
      { reportProgress: true, observe: 'events' }
    );
  }

  getRoomMedia(roomId: number): Observable<RoomMedia> {
    return this.http.get<RoomMedia>(`${this.API}/${roomId}/media`);
  }

  getMyGroupKeys(roomId: number): Observable<GroupKeyResponse[]> {
  return this.http.get<GroupKeyResponse[]>(`${this.API}/${roomId}/groupkey/mine`);
}

getGroupKeyVersionInfo(roomId: number): Observable<GroupKeyVersionInfo> {
  return this.http.get<GroupKeyVersionInfo>(`${this.API}/${roomId}/groupkey/version-info`);
}

distributeGroupKey(roomId: number, version: number, distributorPublicKey: string,
  entries: { userId: string; encryptedKey: string }[]): Observable<any> {
  return this.http.post(`${this.API}/${roomId}/groupkey/distribute`, {
    version, distributorPublicKey, entries
  });
}

logCall(chatRoomId: number, receiverId: string, isVideo: boolean,
  durationSeconds: number, status: string): Observable<any> {
  return this.http.post(`${environment.apiUrl}/calllogs`, {
    chatRoomId, receiverId, isVideo, durationSeconds, status
  });
}

getCallLogs(roomId?: number): Observable<CallLog[]> {
  const params = roomId ? `?roomId=${roomId}` : '';
  return this.http.get<CallLog[]>(`${environment.apiUrl}/calllogs${params}`);
}

}