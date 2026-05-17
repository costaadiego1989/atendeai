import { Injectable } from '@nestjs/common';
import { ProspectSearchSource } from '../../domain/value-objects/ProspectSearchSource';
import { IProspectSearchSource } from '../../domain/ports/IProspectSearchSource';
import { IProspectSearchSourceRegistry } from '../../domain/ports/IProspectSearchSourceRegistry';
import { GooglePlacesProspectSearchSource } from './GooglePlacesProspectSearchSource';

@Injectable()
export class ProspectSearchSourceRegistry implements IProspectSearchSourceRegistry {
  private readonly sources = new Map<string, IProspectSearchSource>();

  constructor(googlePlacesSource: GooglePlacesProspectSearchSource) {
    this.sources.set(googlePlacesSource.source, googlePlacesSource);
  }

  resolve(source: ProspectSearchSource): IProspectSearchSource | null {
    return this.sources.get(source) ?? null;
  }
}
