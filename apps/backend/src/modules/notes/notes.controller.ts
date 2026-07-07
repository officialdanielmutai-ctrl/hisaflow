import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  // ── Create a note ─────────────────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Post()
  create(
    @OrgContext() orgId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(orgId, user.id, dto);
  }

  // ── List all notes ────────────────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Get()
  findAll(
    @OrgContext() orgId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.notesService.findAll(orgId, { status, from, to });
  }

  // ── Get a single note ─────────────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Get(':id')
  findOne(@Param('id') id: string, @OrgContext() orgId: string) {
    return this.notesService.findOne(id, orgId);
  }

  // ── Update a note ─────────────────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @OrgContext() orgId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(id, orgId, dto);
  }

  // ── Delete a note ─────────────────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @OrgContext() orgId: string) {
    return this.notesService.remove(id, orgId);
  }

  // ── Checklist: add item ───────────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Post(':id/items')
  addChecklistItem(
    @Param('id') noteId: string,
    @OrgContext() orgId: string,
    @Body('text') text: string,
  ) {
    return this.notesService.addChecklistItem(noteId, orgId, text);
  }

  // ── Checklist: toggle item ────────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Patch('items/:itemId/toggle')
  toggleChecklistItem(@Param('itemId') itemId: string) {
    return this.notesService.toggleChecklistItem(itemId);
  }

  // ── Checklist: delete item ────────────────────────────────────────────────
  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Delete('items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteChecklistItem(@Param('itemId') itemId: string) {
    return this.notesService.deleteChecklistItem(itemId);
  }
}
