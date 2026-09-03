import { Directive, ElementRef, Input } from '@angular/core';

@Directive({
  selector: 'video[appVideoStream], audio[appVideoStream]',
  standalone: true
})
export class VideoStreamDirective {
  @Input() set appVideoStream(stream: MediaStream | null) {
    this.el.nativeElement.srcObject = stream;
  }

  constructor(private el: ElementRef<HTMLVideoElement>) {}
}