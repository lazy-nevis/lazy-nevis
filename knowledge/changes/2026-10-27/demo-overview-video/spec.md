---
type: concept
title: demo-overview-video — spec
description: 16:9 Full Mode screenshot frame, demo-mode screen recordings, and a product overview video built from them.
tags: [change, spec, demo, screenshots, video]
---

# Spec — demo-overview-video

## Why

The project needs a short overview video of LazyNevis (screens, features, how it works). The
screenshot frame (1280×860) is not video-shaped and shows less of each screen than a 1080p
frame can hold. The capture displays run at 1× scale, so the only way to get more pixels is a
larger logical frame.

## What

- Full Mode screenshots use a 16:9 logical frame of **1920×1080**, matching a 1080p video frame
  pixel for pixel on a 1× display. Compact Mode stays 400×900.
- Short screen recordings of the demo profile (`bun run dev:demo`) show navigation and motion
  that stills cannot (running timer, distraction overlay, dashboard, habit logging).
  Recordings are working assets for the video, not committed to the repository.
- An overview video is authored in the 21st video editor from the screenshots and
  recordings, and exported as MP4.

## Requirements

- The screenshot-automation capability states the 1920×1080 Full Mode frame.
- All shots and recordings use fictional demo data only.

## Findings

- The capture displays (3440×1440 and 1920×1080) report a backing scale of 1, so screenshots
  are 1×. The Screen Recording permission does not change that; only the logical frame does.
