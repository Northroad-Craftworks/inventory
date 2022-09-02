import { Router } from "express";
import * as item from "../operations/item.js";

const router = new Router();
export default router;

router.get('/items?', item.list)
router.get('/items?/:itemId', item.fetch)
router.put('/items?/:itemId', item.define)
router.delete('/items?/:itemId', item.destroy)



