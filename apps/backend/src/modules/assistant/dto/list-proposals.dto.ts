import { AssistantProposalStatus } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';

export class ListProposalsDto {
  @IsOptional()
  @IsIn(Object.values(AssistantProposalStatus))
  status?: AssistantProposalStatus;
}
