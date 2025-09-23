import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as ctrl from '../controllers/attachments.controller';

const router = Router();
router.post('/presign', asyncHandler(ctrl.postPresignUpload));
router.post('/register', asyncHandler(ctrl.postRegisterAttachment));
router.get('/download', asyncHandler(ctrl.getPresignDownload));
router.delete('/:id', asyncHandler(ctrl.deleteAttachment));

export default router;
