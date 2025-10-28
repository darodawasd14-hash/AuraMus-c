import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getYoutubeVideoId(url: string): string | null {
  // Bu regex, farklı YouTube URL formatlarından video ID'sini yakalamak için
  // internetteki en yaygın ve güvenilir kalıplardan biridir.
  const regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);

  if (match && match[7].length === 11) {
    return match[7]; // Başarılı, video ID'sini döndür
  } else {
    return null; // Eşleşme bulunamadı
  }
}
