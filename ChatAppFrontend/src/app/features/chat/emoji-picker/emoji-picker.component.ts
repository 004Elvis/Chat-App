import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface EmojiEntry {
  char: string;
  keywords: string;
}

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: EmojiEntry[];
}

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './emoji-picker.component.html',
  styleUrl: './emoji-picker.component.css'
})
export class EmojiPickerComponent {
  @Output() emojiSelected = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  searchQuery = '';
  activeCategoryIndex = signal(0);

  categories: EmojiCategory[] = [
    {
      name: 'Smileys', icon: '😀',
      emojis: [
        { char: '😀', keywords: 'smile happy grin' },
        { char: '😃', keywords: 'smile happy joy' },
        { char: '😄', keywords: 'smile happy laugh' },
        { char: '😁', keywords: 'grin smile happy' },
        { char: '😆', keywords: 'laugh happy lol' },
        { char: '😅', keywords: 'sweat laugh nervous' },
        { char: '🤣', keywords: 'rofl laugh funny' },
        { char: '😂', keywords: 'joy laugh tears funny' },
        { char: '🙂', keywords: 'smile slight' },
        { char: '🙃', keywords: 'upside down silly' },
        { char: '😉', keywords: 'wink' },
        { char: '😊', keywords: 'blush smile happy' },
        { char: '😇', keywords: 'angel innocent halo' },
        { char: '🥰', keywords: 'love hearts smile' },
        { char: '😍', keywords: 'love heart eyes' },
        { char: '🤩', keywords: 'star struck excited' },
        { char: '😘', keywords: 'kiss love' },
        { char: '😗', keywords: 'kiss' },
        { char: '😋', keywords: 'yum tongue tasty' },
        { char: '😛', keywords: 'tongue playful' },
        { char: '😜', keywords: 'wink tongue silly' },
        { char: '🤪', keywords: 'zany crazy silly' },
        { char: '😝', keywords: 'tongue closed eyes' },
        { char: '🤑', keywords: 'money rich' },
        { char: '🤗', keywords: 'hug' },
        { char: '🤭', keywords: 'giggle oops' },
        { char: '🤫', keywords: 'shh quiet secret' },
        { char: '🤔', keywords: 'think hmm' },
        { char: '🫡', keywords: 'salute respect' },
        { char: '🤐', keywords: 'zip mouth quiet' },
        { char: '🤨', keywords: 'suspicious eyebrow' },
        { char: '😐', keywords: 'neutral meh' },
        { char: '😑', keywords: 'expressionless blank' },
        { char: '😶', keywords: 'no mouth silent' },
        { char: '😏', keywords: 'smirk' },
        { char: '😒', keywords: 'unamused annoyed' },
        { char: '🙄', keywords: 'eye roll annoyed' },
        { char: '😬', keywords: 'grimace awkward' },
        { char: '😮‍💨', keywords: 'exhale relief sigh' },
        { char: '🤥', keywords: 'lying nose' },
        { char: '😌', keywords: 'relieved calm' },
        { char: '😔', keywords: 'sad pensive' },
        { char: '😪', keywords: 'sleepy tired' },
        { char: '🤤', keywords: 'drool' },
        { char: '😴', keywords: 'sleep zzz' },
        { char: '😷', keywords: 'mask sick' },
        { char: '🤒', keywords: 'sick thermometer' },
        { char: '🤕', keywords: 'hurt injured bandage' },
        { char: '🤢', keywords: 'sick nauseous' },
        { char: '🤮', keywords: 'vomit sick' },
        { char: '🥵', keywords: 'hot sweating' },
        { char: '🥶', keywords: 'cold freezing' },
        { char: '😵', keywords: 'dizzy confused' },
        { char: '😵‍💫', keywords: 'dizzy spiral confused' },
        { char: '🤯', keywords: 'mind blown shocked' },
        { char: '🥳', keywords: 'party celebrate' },
        { char: '😎', keywords: 'cool sunglasses' },
        { char: '🤓', keywords: 'nerd glasses' },
        { char: '🧐', keywords: 'monocle curious' },
        { char: '😕', keywords: 'confused' },
        { char: '😟', keywords: 'worried' },
        { char: '🙁', keywords: 'frown sad' },
        { char: '😮', keywords: 'shocked surprised' },
        { char: '😯', keywords: 'surprised' },
        { char: '😲', keywords: 'astonished shocked' },
        { char: '😳', keywords: 'flushed embarrassed' },
        { char: '🥺', keywords: 'pleading puppy eyes' },
        { char: '😦', keywords: 'frown open mouth' },
        { char: '😧', keywords: 'anguished' },
        { char: '😨', keywords: 'fearful scared' },
        { char: '😰', keywords: 'anxious sweat' },
        { char: '😥', keywords: 'sad relieved' },
        { char: '😢', keywords: 'cry sad tear' },
        { char: '😭', keywords: 'sob crying loud' },
        { char: '😱', keywords: 'scream fear shocked' },
        { char: '😖', keywords: 'confounded upset' },
        { char: '😣', keywords: 'persevere struggling' },
        { char: '😞', keywords: 'disappointed sad' },
        { char: '😓', keywords: 'downcast sweat' },
        { char: '😩', keywords: 'weary tired' },
        { char: '😫', keywords: 'tired exhausted' },
        { char: '🥱', keywords: 'yawn tired bored' },
        { char: '😤', keywords: 'triumph frustrated' },
        { char: '😡', keywords: 'angry mad rage' },
        { char: '😠', keywords: 'angry mad' },
        { char: '🤬', keywords: 'cursing swearing angry' }
      ]
    },
    {
      name: 'Gestures', icon: '👍',
      emojis: [
        { char: '👍', keywords: 'thumbs up good yes like' },
        { char: '👎', keywords: 'thumbs down bad no dislike' },
        { char: '👌', keywords: 'ok okay perfect' },
        { char: '✌️', keywords: 'peace victory' },
        { char: '🤞', keywords: 'fingers crossed hope' },
        { char: '🤟', keywords: 'love you' },
        { char: '🤘', keywords: 'rock horns' },
        { char: '🤙', keywords: 'call me' },
        { char: '👈', keywords: 'point left' },
        { char: '👉', keywords: 'point right' },
        { char: '👆', keywords: 'point up' },
        { char: '👇', keywords: 'point down' },
        { char: '☝️', keywords: 'point up one' },
        { char: '✋', keywords: 'stop hand raised' },
        { char: '🤚', keywords: 'hand back raised' },
        { char: '🖐️', keywords: 'hand fingers splayed' },
        { char: '🖖', keywords: 'vulcan spock' },
        { char: '👋', keywords: 'wave hello bye' },
        { char: '🤝', keywords: 'handshake deal' },
        { char: '🙏', keywords: 'pray please thanks' },
        { char: '✍️', keywords: 'writing hand' },
        { char: '💪', keywords: 'muscle strong flex' },
        { char: '🦾', keywords: 'mechanical arm strong' },
        { char: '👏', keywords: 'clap applause' },
        { char: '🙌', keywords: 'raised hands celebrate' },
        { char: '👐', keywords: 'open hands' },
        { char: '🤲', keywords: 'palms together' },
        { char: '🫶', keywords: 'heart hands love' },
        { char: '🤛', keywords: 'fist bump left' },
        { char: '🤜', keywords: 'fist bump right' },
        { char: '👊', keywords: 'fist bump punch' },
        { char: '✊', keywords: 'fist raised power' }
      ]
    },
    {
      name: 'Hearts', icon: '❤️',
      emojis: [
        { char: '❤️', keywords: 'red heart love' },
        { char: '🧡', keywords: 'orange heart' },
        { char: '💛', keywords: 'yellow heart' },
        { char: '💚', keywords: 'green heart' },
        { char: '💙', keywords: 'blue heart' },
        { char: '💜', keywords: 'purple heart' },
        { char: '🖤', keywords: 'black heart' },
        { char: '🤍', keywords: 'white heart' },
        { char: '🤎', keywords: 'brown heart' },
        { char: '💔', keywords: 'broken heart sad' },
        { char: '❣️', keywords: 'heart exclamation' },
        { char: '💕', keywords: 'two hearts love' },
        { char: '💞', keywords: 'revolving hearts' },
        { char: '💓', keywords: 'beating heart' },
        { char: '💗', keywords: 'growing heart' },
        { char: '💖', keywords: 'sparkling heart' },
        { char: '💘', keywords: 'heart arrow cupid' },
        { char: '💝', keywords: 'heart gift' },
        { char: '💯', keywords: 'hundred perfect score' },
        { char: '🔥', keywords: 'fire lit hot' }
      ]
    },
    {
      name: 'Animals', icon: '🐶',
      emojis: [
        { char: '🐶', keywords: 'dog puppy' },
        { char: '🐱', keywords: 'cat kitten' },
        { char: '🐭', keywords: 'mouse' },
        { char: '🐹', keywords: 'hamster' },
        { char: '🐰', keywords: 'rabbit bunny' },
        { char: '🦊', keywords: 'fox' },
        { char: '🐻', keywords: 'bear' },
        { char: '🐼', keywords: 'panda' },
        { char: '🐨', keywords: 'koala' },
        { char: '🐯', keywords: 'tiger' },
        { char: '🦁', keywords: 'lion' },
        { char: '🐮', keywords: 'cow' },
        { char: '🐷', keywords: 'pig' },
        { char: '🐸', keywords: 'frog' },
        { char: '🐵', keywords: 'monkey' },
        { char: '🐔', keywords: 'chicken' },
        { char: '🐧', keywords: 'penguin' },
        { char: '🐦', keywords: 'bird' },
        { char: '🦄', keywords: 'unicorn' },
        { char: '🐝', keywords: 'bee' },
        { char: '🦋', keywords: 'butterfly' },
        { char: '🐢', keywords: 'turtle' },
        { char: '🐍', keywords: 'snake' },
        { char: '🐙', keywords: 'octopus' },
        { char: '🐳', keywords: 'whale' },
        { char: '🐬', keywords: 'dolphin' }
      ]
    },
    {
      name: 'Food', icon: '🍕',
      emojis: [
        { char: '🍏', keywords: 'apple green' },
        { char: '🍎', keywords: 'apple red' },
        { char: '🍌', keywords: 'banana' },
        { char: '🍉', keywords: 'watermelon' },
        { char: '🍇', keywords: 'grapes' },
        { char: '🍓', keywords: 'strawberry' },
        { char: '🍒', keywords: 'cherry' },
        { char: '🍍', keywords: 'pineapple' },
        { char: '🥭', keywords: 'mango' },
        { char: '🍑', keywords: 'peach' },
        { char: '🥑', keywords: 'avocado' },
        { char: '🍕', keywords: 'pizza' },
        { char: '🍔', keywords: 'burger' },
        { char: '🍟', keywords: 'fries' },
        { char: '🌭', keywords: 'hot dog' },
        { char: '🌮', keywords: 'taco' },
        { char: '🍿', keywords: 'popcorn' },
        { char: '🍩', keywords: 'donut' },
        { char: '🍪', keywords: 'cookie' },
        { char: '🎂', keywords: 'cake birthday' },
        { char: '🍰', keywords: 'cake slice' },
        { char: '🍫', keywords: 'chocolate' },
        { char: '🍬', keywords: 'candy' },
        { char: '🍭', keywords: 'lollipop' },
        { char: '☕', keywords: 'coffee' },
        { char: '🍵', keywords: 'tea' },
        { char: '🥤', keywords: 'drink soda' },
        { char: '🍺', keywords: 'beer' },
        { char: '🍷', keywords: 'wine' },
        { char: '🍽️', keywords: 'plate food meal' }
      ]
    },
    {
      name: 'Symbols', icon: '✨',
      emojis: [
        { char: '✨', keywords: 'sparkles shine' },
        { char: '⭐', keywords: 'star' },
        { char: '🌟', keywords: 'glowing star' },
        { char: '💫', keywords: 'dizzy stars' },
        { char: '🎉', keywords: 'party celebrate confetti' },
        { char: '🎊', keywords: 'confetti ball' },
        { char: '🎁', keywords: 'gift present' },
        { char: '🏆', keywords: 'trophy win' },
        { char: '🥇', keywords: 'gold medal first' },
        { char: '⚡', keywords: 'lightning bolt zap' },
        { char: '💥', keywords: 'boom explosion' },
        { char: '💤', keywords: 'sleep zzz' },
        { char: '💬', keywords: 'speech bubble chat' },
        { char: '💭', keywords: 'thought bubble' },
        { char: '✅', keywords: 'check mark done' },
        { char: '❌', keywords: 'cross mark no' },
        { char: '❓', keywords: 'question mark' },
        { char: '❗', keywords: 'exclamation mark' },
        { char: '⚠️', keywords: 'warning caution' },
        { char: '🔔', keywords: 'bell notification' },
        { char: '🔒', keywords: 'lock secure' },
        { char: '🔑', keywords: 'key' },
        { char: '💡', keywords: 'idea light bulb' },
        { char: '📌', keywords: 'pin' },
        { char: '🎯', keywords: 'target goal' }
      ]
    }
  ];

  get filteredEmojis(): EmojiEntry[] {
    if (!this.searchQuery.trim()) {
      return this.categories[this.activeCategoryIndex()].emojis;
    }
    const q = this.searchQuery.trim().toLowerCase();
    return this.categories
      .flatMap(c => c.emojis)
      .filter(e => e.keywords.includes(q));
  }

  selectCategory(index: number): void {
    this.activeCategoryIndex.set(index);
    this.searchQuery = '';
  }

  pick(emoji: string): void {
    this.emojiSelected.emit(emoji);
  }

  close(): void {
    this.closed.emit();
  }
}