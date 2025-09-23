import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as ctrl from '../controllers/projects.controller';
import * as tasksCtrl from '../controllers/tasks.controller';

const router = Router();
router.get('/', asyncHandler(ctrl.getProjects));
router.post('/', asyncHandler(ctrl.postProject));

router.get('/:id/tasks', asyncHandler(tasksCtrl.getTasksByProject));

export default router;
