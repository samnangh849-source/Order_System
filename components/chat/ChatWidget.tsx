import React, { useState, useContext, useRef, useEffect, useCallback } from 'react';
import { AppContext } from '../../App';
import { ChatMessage, User, BackendChatMessage } from '../../types';
import Spinner from '../common/Spinner';
// import { useAudioRecorder } from '../../hooks/useAudioRecorder'; // Feature removed
import { compressImage } from '../../utils/imageCompressor';
import { WEB_APP_URL } from '../../constants';
import AudioPlayer from './AudioPlayer';
import { fileToBase64, convertGoogleDriveUrl } from '../../utils/fileUtils';

interface ChatWidgetProps {
    isOpen: boolean;
    onClose: () => void;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
type ActiveTab = 'chat' | 'users';

// Use the custom notification sound. Assumes `notification.mp3` is in the public folder.
const notificationSound = new Audio('/notification.mp3');

const ChatWidget: React.FC<ChatWidgetProps> = ({ isOpen, onClose }) => {
    const { currentUser, appData, previewImage } = useContext(AppContext);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('chatMuted') === 'true');
    const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
    const [mentionSelectionIndex, setMentionSelectionIndex] = useState<number>(0);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [activeTab, setActiveTab] = useState<ActiveTab>('chat');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // Voice recording feature removed
    const hasFetchedHistory = useRef(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const transformBackendMessage = useCallback((msg: BackendChatMessage): ChatMessage => {
        const user = appData.users?.find((u: User) => u.UserName === msg.UserName);
        const finalContent = (msg.MessageType === 'image' || msg.MessageType === 'audio')
            ? convertGoogleDriveUrl(msg.Content, msg.MessageType)
            : msg.Content;

        return {
            id: msg.Timestamp,
            user: msg.UserName,
            fullName: user?.FullName || msg.UserName,
            avatar: convertGoogleDriveUrl(user?.ProfilePictureURL, 'image'),
            content: finalContent,
            timestamp: msg.Timestamp,
            type: msg.MessageType,
            fileID: msg.FileID, // Include FileID
        };
    }, [appData.users]);

    const fetchHistory = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) {
            setIsHistoryLoading(true);
        }
        try {
            const response = await fetch(`${WEB_APP_URL}/api/chat/messages`);
            if (!response.ok) throw new Error("Failed to fetch chat history");
            const result = await response.json();
            if (result.status === 'success' && Array.isArray(result.data)) {
                const fetchedMessages = result.data.map(transformBackendMessage);
                setMessages(currentMessages => {
                    const messageMap = new Map<string, ChatMessage>();
                    // For reconnects, add current messages first to preserve state
                    if (!isInitialLoad) {
                        currentMessages.forEach(msg => messageMap.set(msg.id, msg));
                    }
                    // Add fetched messages, overwriting/adding new ones
                    fetchedMessages.forEach(msg => messageMap.set(msg.id, msg));
                    // Convert back to array and sort by timestamp
                    return Array.from(messageMap.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                });
            }
        } catch (error) {
            console.error("Chat history error:", error);
        } finally {
            if (isInitialLoad) {
                setIsHistoryLoading(false);
                hasFetchedHistory.current = true;
            }
        }
    }, [transformBackendMessage]);

    useEffect(() => {
        if (isOpen && !hasFetchedHistory.current) {
            fetchHistory(true); // isInitialLoad = true
        }
    }, [isOpen, fetchHistory]);

    const connectWebSocket = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState < 2) { // 0: CONNECTING, 1: OPEN
            return;
        }

        setConnectionStatus('connecting');
        const wsUrl = WEB_APP_URL.replace(/^http/, 'ws') + '/api/chat/ws';
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
            setConnectionStatus('connected');
            // On connect/reconnect, fetch any messages that might have been missed.
            fetchHistory(false); // isInitialLoad = false
        };

        ws.onclose = (event) => {
            console.log("WebSocket disconnected", event.code, event.reason);
            setConnectionStatus('disconnected');
            if (isOpen && event.code !== 1000) { // Don't reconnect on clean close
                if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
            }
        };

        ws.onerror = (errorEvent) => {
            console.error("A WebSocket error occurred. This is often followed by a 'close' event with more details. Raw event:", errorEvent);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.action === 'delete_message' && data.payload?.timestamp) {
                    setMessages(prev => prev.filter(msg => msg.id !== data.payload.timestamp));
                    return;
                }
                
                if (data.action === 'new_message' && data.payload?.Timestamp) {
                    const newMsg = transformBackendMessage(data.payload);
                    setMessages(prev => {
                        // Prevent duplicates if message already exists
                        if (prev.some(m => m.id === newMsg.id && m.user === newMsg.user)) {
                            return prev;
                        }
                        return [...prev, newMsg];
                    });

                    if (newMsg.user !== currentUser?.UserName && !isMuted) {
                       notificationSound.play().catch(e => console.log("Notification sound blocked by browser."));
                    }
                }
            } catch (error) {
                console.error("Failed to parse WebSocket message:", error);
            }
        };
    }, [isOpen, currentUser?.UserName, isMuted, transformBackendMessage, fetchHistory]);

    useEffect(() => {
        if (isOpen && hasFetchedHistory.current) {
            connectWebSocket();
        }

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.onclose = null; // Prevent reconnect logic on manual close
                wsRef.current.close(1000, "Component unmounting or widget closing");
                wsRef.current = null;
            }
        };
    }, [isOpen, hasFetchedHistory.current, connectWebSocket]);


    useEffect(() => {
        if(activeTab === 'chat'){
             messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, activeTab]);

    const handleToggleMute = () => {
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);
        localStorage.setItem('chatMuted', String(newMutedState));
    };
    
    const handleSendMessage = async (content: string, type: 'text' | 'image' | 'audio', mimeType?: string) => {
        if (!currentUser || !content.trim()) return;

        let originalMessage = '';
        if (type === 'text') {
            originalMessage = content;
            setNewMessage('');
        }
        
        const payload: any = {
            userName: currentUser.UserName,
            type: type,
            content: content.trim(),
            ...(mimeType && { mimeType: mimeType }),
        };

        try {
            const response = await fetch(`${WEB_APP_URL}/api/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok || result.status !== 'success') {
                let serverMessage;
                // Safely extract server message
                if (result) {
                    if (typeof result.message === 'string' && result.message) {
                        serverMessage = result.message;
                    } else if (typeof result.error === 'string' && result.error) {
                        serverMessage = result.error;
                    } else if (typeof result === 'string') {
                        serverMessage = result;
                    } else {
                        try {
                            serverMessage = JSON.stringify(result);
                        } catch {
                            serverMessage = "Could not parse server error response.";
                        }
                    }
                } else {
                     serverMessage = `Server responded with status ${response.status}.`;
                }
                
                let userFriendlyMessage = "ការផ្ញើសារបានបរាជ័យ។"; // "Message sending failed."
                if (serverMessage.includes('Upload Folder ID is not configured')) {
                    userFriendlyMessage = 'ការផ្ញើសារបានបរាជ័យ។ ការកំណត់រចនាសម្ព័ន្ធការ Upload ឯកសារលើ Server មិនត្រឹមត្រូវទេ។';
                } else {
                    userFriendlyMessage += ` Server បានឆ្លើយតបថា: ${serverMessage}`;
                }
                throw new Error(userFriendlyMessage);
            }

            // The backend returns the created message, but we let the WebSocket handle the update
            // to maintain a single source of truth for message additions.

        } catch(error) {
            console.error("Error sending message:", error);
            
            let alertMessage;
            if (error instanceof Error) {
                alertMessage = error.message;
            } else if (typeof error === 'string') {
                alertMessage = error;
            } else if (error && typeof error === 'object') {
                const errObj = error as any;
                alertMessage = errObj.message || errObj.error || 'An object was thrown as an error. See console for details.';
            } else {
                alertMessage = 'An unknown error occurred.';
            }
            
            // Final guarantee that alert displays a readable string.
            alert(String(alertMessage || 'An unknown error occurred.'));
            
            if (type === 'text') {
                setNewMessage(originalMessage);
            }
        }
    };
    
    const handleDeleteMessage = async (messageId: string) => {
        if (!currentUser || !window.confirm('តើអ្នកពិតជាចង់លុបសារនេះមែនទេ?')) return;

        const messageToDelete = messages.find(m => m.id === messageId);
        if (!messageToDelete) return;
        
        try {
            const response = await fetch(`${WEB_APP_URL}/api/chat/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    timestamp: messageId,
                    fileID: messageToDelete.fileID // Pass the fileID if it exists
                })
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: 'Server responded with an error.' }));
                throw new Error(errData.message || 'Failed to delete the message.');
            }
            // Let the websocket handle the removal from state for all clients.

        } catch (error) {
            console.error("Error deleting message:", error);
            alert(`Could not delete message: ${(error as Error).message}`);
        }
    };

    const handleFileUpload = async (file: File) => {
        if (!file) return;
        setIsUploading(true);
        try {
            const processedFile = await compressImage(file);
            const base64Data = await fileToBase64(processedFile);
            await handleSendMessage(base64Data, 'image', processedFile.type);
        } catch (error) {
            console.error(`Failed to upload image:`, error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value;
        setNewMessage(text);
        
        const mentionMatch = text.match(/@(\w*)$/);
        if (mentionMatch) {
            const filteredUsers = (appData.users || []).filter((user: User) => 
                user.UserName.toLowerCase().includes(mentionMatch[1].toLowerCase()) &&
                user.UserName !== currentUser?.UserName
            );
            setMentionSuggestions(filteredUsers.slice(0, 5));
            setMentionSelectionIndex(0); // Reset selection when suggestions change
        } else {
            setMentionSuggestions([]);
        }
    };

    const handleMentionSelect = (username: string) => {
        const currentText = newMessage;
        const newText = currentText.replace(/@(\w*)$/, `@${username} `);
        setNewMessage(newText);
        setMentionSuggestions([]);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (mentionSuggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionSelectionIndex(prev => (prev + 1) % mentionSuggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionSelectionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (mentionSuggestions[mentionSelectionIndex]) {
                    handleMentionSelect(mentionSuggestions[mentionSelectionIndex].UserName);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setMentionSuggestions([]);
            }
        } else if (e.key === 'Enter') {
            handleSendMessage(newMessage, 'text');
        }
    };

    const renderMessageContent = (content: string) => {
        const parts = content.split(/(@\w+)/g);
        return parts.map((part, index) => {
            if (part.startsWith('@')) {
                const username = part.substring(1);
                const userExists = appData.users?.some((u: User) => u.UserName === username);
                if (userExists) {
                    return <span key={index} className="mention-highlight">{part}</span>;
                }
            }
            return part;
        });
    };
    
    const ChatView = () => (
        <div className="chat-messages">
            {isHistoryLoading ? (
                <div className="flex-grow flex items-center justify-center"><Spinner /></div>
            ) : (
                messages.map(msg => (
                    <div key={msg.id} className={`message-container ${msg.user === currentUser?.UserName ? 'current-user' : ''}`}>
                         <div className={`message-bubble ${msg.user === currentUser?.UserName ? 'current-user' : ''}`}>
                             <img 
                                src={msg.avatar} 
                                alt={msg.fullName} 
                                className="avatar cursor-pointer hover:opacity-80 transition-opacity" 
                                onClick={() => previewImage(msg.avatar)}
                              />
                             <div className="flex flex-col">
                                <div className="message-content">
                                    {msg.user !== currentUser?.UserName && <p className="font-bold text-xs text-blue-300 mb-1">{msg.fullName}</p>}
                                    {msg.type === 'text' && <p>{renderMessageContent(msg.content)}</p>}
                                    {msg.type === 'image' && 
                                        <img 
                                            src={msg.content} 
                                            alt="uploaded content" 
                                            className="max-w-xs rounded-md cursor-pointer hover:opacity-80 transition-opacity" 
                                            onClick={() => previewImage(msg.content)}
                                        />
                                    }
                                    {msg.type === 'audio' && msg.content && <AudioPlayer src={msg.content} />}
                                </div>
                                <span className="message-info">{new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit'})}</span>
                             </div>
                        </div>
                        {msg.user === currentUser?.UserName && (
                             <button onClick={() => handleDeleteMessage(msg.id)} className="delete-message-btn" title="លុបសារ">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                   <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                 </svg>
                             </button>
                        )}
                    </div>
                ))
            )}
            <div ref={messagesEndRef} />
        </div>
    );

    const UserListView = () => (
        <div className="user-list">
            {(appData.users || []).map((user: User) => (
                <div key={user.UserName} className="user-list-item">
                    <img 
                        src={convertGoogleDriveUrl(user.ProfilePictureURL, 'image')} 
                        alt={user.FullName} 
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => previewImage(convertGoogleDriveUrl(user.ProfilePictureURL, 'image'))}
                    />
                    <div className="user-info">
                        <span className="fullname">{user.FullName}</span>
                        <span className="username">@{user.UserName}</span>
                    </div>
                </div>
            ))}
        </div>
    );


    return (
        <div className={`chat-widget-container ${!isOpen ? 'closed' : ''}`}>
            <div className="chat-header">
                <div className="title-group">
                    <div className={`connection-status ${connectionStatus === 'connected' ? 'connected' : connectionStatus === 'connecting' ? 'connecting' : ''}`} title={`Status: ${connectionStatus}`}></div>
                    <h3>ប្រព័ន្ធជជែកកំសាន្ត</h3>
                </div>
                <div className="controls">
                    <button onClick={handleToggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
                        {isMuted ? 
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg> :
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A.5.5 0 002 14h16a.5.5 0 00.354-.854L16 11.586V8a6 6 0 00-6-6zM8 16a2 2 0 114 0H8z" /></svg>
                        }
                    </button>
                    <button onClick={onClose} aria-label="Close Chat">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            <div className="chat-tabs">
                <button onClick={() => setActiveTab('chat')} className={`chat-tab ${activeTab === 'chat' ? 'active' : ''}`}>ជជែកកម្សាន្ត</button>
                <button onClick={() => setActiveTab('users')} className={`chat-tab ${activeTab === 'users' ? 'active' : ''}`}>អ្នកប្រើប្រាស់</button>
            </div>
            
            <div className="chat-body">
                {activeTab === 'chat' ? <ChatView /> : <UserListView />}
            </div>

            {activeTab === 'chat' && (
                <div className="chat-input-area">
                    {mentionSuggestions.length > 0 && (
                        <div className="mention-suggestions-popup">
                            {mentionSuggestions.map((user, index) => (
                                <div 
                                    key={user.UserName} 
                                    onClick={() => handleMentionSelect(user.UserName)} 
                                    className={`mention-item ${index === mentionSelectionIndex ? 'selected' : ''}`}
                                >
                                    <img src={convertGoogleDriveUrl(user.ProfilePictureURL, 'image')} alt={user.FullName} />
                                    <span className="fullname">{user.FullName}</span>
                                    <span className="username">@{user.UserName}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="icon-btn" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                        {isUploading ? <Spinner size="sm"/> :
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        }
                    </button>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} className="hidden" />
                    
                    <div className="chat-input-wrapper">
                        <input
                            ref={inputRef}
                            type="text" 
                            value={newMessage}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="វាយសារ..." 
                            className="form-input"
                        />
                        <button onClick={() => handleSendMessage(newMessage, 'text')} className="send-btn" disabled={!newMessage.trim()}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M3.105 3.106a.75.75 0 01.884-.043l11.25 6.5a.75.75 0 010 1.273l-11.25 6.5a.75.75 0 01-1.273-.636V3.742a.75.75 0 01.43-.636z" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatWidget;