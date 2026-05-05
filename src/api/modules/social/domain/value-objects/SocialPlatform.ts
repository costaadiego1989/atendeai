export type SocialPlatformType = 'INSTAGRAM' | 'LINKEDIN';

export class SocialPlatform {
  private constructor(private readonly value: SocialPlatformType) {}

  static create(value: string): SocialPlatform {
    const normalized = value?.toUpperCase().trim();
    if (normalized !== 'INSTAGRAM' && normalized !== 'LINKEDIN') {
      throw new Error(`Invalid social platform: ${value}`);
    }
    return new SocialPlatform(normalized as SocialPlatformType);
  }

  static instagram(): SocialPlatform {
    return new SocialPlatform('INSTAGRAM');
  }

  static linkedin(): SocialPlatform {
    return new SocialPlatform('LINKEDIN');
  }

  get isInstagram(): boolean {
    return this.value === 'INSTAGRAM';
  }

  get isLinkedIn(): boolean {
    return this.value === 'LINKEDIN';
  }

  toString(): string {
    return this.value;
  }

  equals(other: SocialPlatform): boolean {
    return this.value === other.value;
  }
}
