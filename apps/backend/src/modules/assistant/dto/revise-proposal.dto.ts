import { IsObject } from 'class-validator';

export class ReviseProposalDto {
  @IsObject()
  args!: Record<string, unknown>;
}
