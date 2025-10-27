import { PlaceHolderImages } from './placeholder-images';

export type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSeconds: number;
  coverArt: string;
  coverArtHint: string;
};

const getImage = (id: string) => {
  const img = PlaceHolderImages.find(p => p.id === id);
  if (!img) return { url: 'https://picsum.photos/seed/error/300/300', hint: 'error' };
  return { url: img.imageUrl, hint: img.imageHint };
};

export const songs: Song[] = [
  { id: '1', title: 'Midnight City', artist: 'The Voyagers', album: 'Digital Dreams', duration: '3:45', durationSeconds: 225, coverArt: getImage('album-art-1').url, coverArtHint: getImage('album-art-1').hint },
  { id: '2', title: 'Echoes in the Valley', artist: 'Mountain Sound', album: 'Serenity', duration: '4:12', durationSeconds: 252, coverArt: getImage('album-art-2').url, coverArtHint: getImage('album-art-2').hint },
  { id: '3', title: 'Neon Pulse', artist: 'Cyberdrive', album: 'Nightfall', duration: '2:58', durationSeconds: 178, coverArt: getImage('album-art-3').url, coverArtHint: getImage('album-art-3').hint },
  { id: '4', title: 'Silent Lines', artist: 'The Minimalists', album: 'Contrast', duration: '5:02', durationSeconds: 302, coverArt: getImage('album-art-4').url, coverArtHint: getImage('album-art-4').hint },
  { id: '5', title: 'Crimson Bloom', artist: 'Petal Pushers', album: 'Gardens of Sound', duration: '3:30', durationSeconds: 210, coverArt: getImage('album-art-5').url, coverArtHint: getImage('album-art-5').hint },
  { id: '6', title: 'Coastal Memories', artist: 'The Boardwalk', album: 'Seaside Stories', duration: '3:55', durationSeconds: 235, coverArt: getImage('album-art-6').url, coverArtHint: getImage('album-art-6').hint },
  { id: '7', title: 'Light Speed', artist: 'Galaxy Gliders', album: 'Cosmic Rays', duration: '4:20', durationSeconds: 260, coverArt: getImage('album-art-7').url, coverArtHint: getImage('album-art-7').hint },
  { id: '8', title: 'Fallen Leaves', artist: 'Forest Floor', album: 'Amber & Gold', duration: '3:15', durationSeconds: 195, coverArt: getImage('album-art-8').url, coverArtHint: getImage('album-art-8').hint },
  { id: '9', title: 'Urban Canvas', artist: 'Graffiti Kings', album: 'Street Symphony', duration: '2:48', durationSeconds: 168, coverArt: getImage('album-art-9').url, coverArtHint: getImage('album-art-9').hint },
  { id: '10', title: 'Painted Sky', artist: 'Sunset Chasers', album: 'Hues of Evening', duration: '4:05', durationSeconds: 245, coverArt: getImage('album-art-10').url, coverArtHint: getImage('album-art-10').hint },
  { id: '11', title: 'Stardust', artist: 'Cosmic Drifters', album: 'Celestial Journey', duration: '5:30', durationSeconds: 330, coverArt: getImage('album-art-11').url, coverArtHint: getImage('album-art-11').hint },
  { id: '12', title: 'Kaleidoscope', artist: 'Color Field', album: 'Vivid', duration: '3:21', durationSeconds: 201, coverArt: getImage('album-art-12').url, coverArtHint: getImage('album-art-12').hint },
  { id: '13', title: 'Bold Strokes', artist: 'Andy', album: 'Factory Sounds', duration: '2:15', durationSeconds: 135, coverArt: getImage('album-art-13').url, coverArtHint: getImage('album-art-13').hint },
  { id: '14', title: 'The Architect', artist: 'Grid & Line', album: 'Structure', duration: '4:44', durationSeconds: 284, coverArt: getImage('album-art-14').url, coverArtHint: getImage('album-art-14').hint },
  { id: '15', title: 'First Light', artist: 'The Shoreliners', album: 'Horizons', duration: '3:50', durationSeconds: 230, coverArt: getImage('album-art-15').url, coverArtHint: getImage('album-art-15').hint },
  { id: '16', title: 'Gilded Age', artist: 'Midas Touch', album: 'Opulence', duration: '3:01', durationSeconds: 181, coverArt: getImage('album-art-16').url, coverArtHint: getImage('album-art-16').hint },
];
