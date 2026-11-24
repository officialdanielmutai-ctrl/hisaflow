-- Assistant upgrade (S4): supersede stale PROPOSED proposals when a newer
-- proposal of the same tool is created in the same conversation.

ALTER TYPE "AssistantProposalStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';
