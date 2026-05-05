import { Injectable, Logger } from '@nestjs/common';
import {
  ITeamMemberCredentialsEmailSender,
  TeamMemberCredentialsEmailInput,
} from '../../application/ports/ITeamMemberCredentialsEmailSender';

@Injectable()
export class ConsoleTeamMemberCredentialsEmailSender
  implements ITeamMemberCredentialsEmailSender
{
  private readonly logger = new Logger(ConsoleTeamMemberCredentialsEmailSender.name);

  async send(input: TeamMemberCredentialsEmailInput): Promise<void> {
    this.logger.log(`Team member credentials generated for ${input.email}`);
  }
}
