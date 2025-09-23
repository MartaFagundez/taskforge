import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as ctrl from '../controllers/tasks.controller';
import * as attachmentsCtrl from '../controllers/attachments.controller';

const router = Router();
router.get('/', asyncHandler(ctrl.getTasks));
router.post('/', asyncHandler(ctrl.postTask));
router.patch('/:id/toggle', asyncHandler(ctrl.patchToggleTask));
router.delete('/:id', asyncHandler(ctrl.deleteTask));
router.get(
  '/:id/attachments',
  asyncHandler(attachmentsCtrl.getAttachmentsByTask),
);

export default router;
