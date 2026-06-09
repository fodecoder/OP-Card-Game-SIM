import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import cardsRouter from "./cards";
import decksRouter from "./decks";
import collectionRouter from "./collection";
import gamesRouter from "./games";
import gameplayRouter from "./gameplay";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(cardsRouter);
router.use(decksRouter);
router.use(collectionRouter);
router.use(gamesRouter);
router.use(gameplayRouter);
router.use(usersRouter);

export default router;
