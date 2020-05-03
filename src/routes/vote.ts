import express from "express";
import createError from "http-errors";
import * as commentAPI from "../api/comment";
import * as userAPI from "../api/user";
import * as utilAPI from "../api/util";
import * as voteAPI from "../api/vote";
import { results, transitions } from "../computer";
import type { Transition } from "../computer";
const router = express.Router();


async function getResults(result: {
    themeID: number;
    result: number[];
}): Promise<{
    themeID: number;
    results: number[];
    counts: number[];
}> {

    return {
        themeID: result.themeID,
        results: result.result,
        counts: await voteAPI.getVoteCounts(result.themeID)
    };
}

router.get("/results", async (_req, res, _next) => {
    res.json(await Promise.all(results.map(result => getResults(result))));
});

router.get("/results/:themeid", async (req, res, next) => {
    const themeID = parseInt(req.params.themeid, 10);

    const result = results.find(result => result.themeID == themeID);
    if (!result) { return next(createError(404)); }

    res.json(await getResults(result));
});

async function getVotes(themeID: number,
    friends: { userProvider: string, userID: string }[],
    influencers: { userProvider: string, userID: string }[]) {
    return {
        themeID,
        votes: await voteAPI.getVotes(themeID, friends),
        votesFromInfluencer: await voteAPI.getVotes(themeID, influencers)
    };
}

router.get("/votes", async (req, res, next) => {
    const sessionToken: unknown = req.query.sessiontoken;

    try {
        const friends = utilAPI.isString(sessionToken)
            ? (await userAPI.getMe(sessionToken))
                .friends.map(userID => ({
                    userProvider: "twitter",
                    userID
                }))
            : [];
        const influencers = await userAPI.getInfluencers();
        res.json(await Promise.all(transitions
            .map(({ themeID }) => getVotes(themeID, friends, influencers))));
    } catch (e) {
        console.log(e);
        next(createError(400));
    }
});

router.get("/votes/:themeid", async (req, res, next) => {
    const themeID = parseInt(req.params.themeid, 10);
    const sessionToken: unknown = req.query.sessiontoken;

    try {
        const friends = utilAPI.isString(sessionToken)
            ? (await userAPI.getMe(sessionToken))
                .friends
                .map(userID => ({
                    userProvider: "twitter",
                    userID
                }))
            : [];
        const influencers = await userAPI.getInfluencers();

        res.json(await getVotes(themeID, friends, influencers));
    } catch (e) {
        console.log(e);
        next(createError(400));
    }
});

router.put("/votes/:themeid", async (req, res, next) => {
    const themeID = parseInt(req.params.themeid, 10);
    const sessionToken: unknown = req.query.sessiontoken;
    const answer: unknown = req.query.answer;

    if (!utilAPI.isString(sessionToken) || !utilAPI.isString(answer)) {
        return next(createError(400));
    }

    try {
        await voteAPI.vote(themeID, sessionToken, parseInt(answer, 10));
        res.status(200).send("");
    } catch (e) {
        console.log(e);
        next(createError(400));
    }
});

function getTransitions(transition: {
    themeID: number;
    shortTransition: Transition[];
    longTransition: Transition[];
}): {
    themeID: number;
    shortTransition: Transition[];
    longTransition: Transition[];
} {
    return {
        themeID: transition.themeID,
        shortTransition: transition.shortTransition,
        longTransition: transition.longTransition
    };
}

router.get("/transitions", async (_req, res, _next) => {
    res.json(transitions.map(transition => getTransitions(transition)));
});

router.get("/transitions/:themeid", (req, res, next) => {
    const themeID = parseInt(req.params.themeid, 10);

    const transition = transitions.find(transition => transition.themeID == themeID);
    if (!transition) { return next(createError(404)); }

    res.json(getTransitions(transition));
});

async function getComments(themeID: number) {
    return {
        themeID,
        comments: await commentAPI.getComments(themeID)
    };
}

router.get("/comments", async (_req, res, next) => {
    try {
        res.json(await Promise.all(transitions
            .map(({ themeID }) => getComments(themeID))));
    } catch (e) {
        console.log(e);
        next(createError(404));
    }
});

router.get("/comments/:themeid", async (req, res, next) => {
    const themeID = parseInt(req.params.themeid, 10);

    try {
        res.json(await getComments(themeID));
    } catch (e) {
        console.log(e);
        next(createError(404));
    }
});

router.post("/comments/:themeid", async (req, res, next) => {
    const themeID = parseInt(req.params.themeid, 10);
    const sessionToken: unknown = req.query.sessiontoken;
    const message: unknown = req.query.message;

    if (!utilAPI.isString(sessionToken) || !utilAPI.isString(message)) {
        return next(createError(400));
    }

    try {
        await commentAPI.comment(themeID, sessionToken, message);
        res.status(201).send("");
    } catch (e) {
        console.log(e);
        next(createError(400));
    }
});

export default router;
