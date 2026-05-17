export type MediaType = 'IMAGE' | 'VIDEO' | 'LINK' | 'AUDIO' | 'DOCUMENT';

export interface MediaAttachmentProps {
  type: MediaType;
  url: string;
  caption?: string;
  mimeType?: string;
}

export class MediaAttachment {
  private constructor(private readonly props: MediaAttachmentProps) {}

  static create(props: MediaAttachmentProps): MediaAttachment {
    if (!props.url?.trim()) {
      throw new Error('Media attachment URL is required');
    }
    return new MediaAttachment({
      type: props.type,
      url: props.url.trim(),
      caption: props.caption?.trim(),
      mimeType: props.mimeType?.trim(),
    });
  }

  get type(): MediaType {
    return this.props.type;
  }
  get url(): string {
    return this.props.url;
  }
  get caption(): string | undefined {
    return this.props.caption;
  }
  get mimeType(): string | undefined {
    return this.props.mimeType;
  }

  toJSON(): MediaAttachmentProps {
    return { ...this.props };
  }
}
