#!/bin/bash
set -e
DB=ibtest
su postgres -c "psql -q -c 'drop database if exists $DB' -c 'create database $DB'"
P="su postgres -c"
run() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f $1"; }
cp -r "$(cd "$(dirname "$0")/.." && pwd)" /tmp/sb && chmod -R a+rX /tmp/sb
run /tmp/sb/tests/stub_supabase.sql
run /tmp/sb/001_schema.sql
run /tmp/sb/002_seed.sql
run /tmp/sb/tests/scenario.sql
