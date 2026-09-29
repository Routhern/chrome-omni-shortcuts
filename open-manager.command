#!/bin/sh
# 로컬 HTML 매니저를 Chrome에서 연다.
cd "$(dirname "$0")" || exit 1
exec open -a "Google Chrome" "$PWD/src/manager/index.html"
