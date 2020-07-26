export function addLeadingSlash(path) { // 添加首'/'
  return path.charAt(0) === '/' ? path : '/' + path;
}

export function stripLeadingSlash(path) { // 删除首'/'
  return path.charAt(0) === '/' ? path.substr(1) : path;
}

export function hasBasename(path, prefix) { // 当前路径是否包含基路径
  return (
    path.toLowerCase().indexOf(prefix.toLowerCase()) === 0 &&
    '/?#'.indexOf(path.charAt(prefix.length)) !== -1
  );
}

export function stripBasename(path, prefix) { // 去掉路径中的基路径
  return hasBasename(path, prefix) ? path.substr(prefix.length) : path;
}

export function stripTrailingSlash(path) { // 去掉路径的末尾斜杠
  return path.charAt(path.length - 1) === '/' ? path.slice(0, -1) : path;
}

export function parsePath(path) { // 将路径字符串分割为path,search,hash三部分，需要注意的是这里的hash是指hash片段，对于hash模式的路径，比如/#/some?id=343 实际上的传入这里的path是/some?id=343，而/#是会被去掉的。
  let pathname = path || '/';
  let search = '';
  let hash = '';

  const hashIndex = pathname.indexOf('#');
  if (hashIndex !== -1) { // 存在hash片段则进行分割——hash片段位于末尾，所以先分割出hash字串。
    hash = pathname.substr(hashIndex); // 包含sharp符号
    pathname = pathname.substr(0, hashIndex); // pathname被修改，去掉了hash部分
  }

  const searchIndex = pathname.indexOf('?');
  if (searchIndex !== -1) { // 存在查询字串则进行分割
    search = pathname.substr(searchIndex); // 包含问号
    pathname = pathname.substr(0, searchIndex); // pathname再次被修改，去掉了查询字符串部分
  }

  return {
    pathname,
    search: search === '?' ? '' : search, // 没有内容则返回空字串
    hash: hash === '#' ? '' : hash // 没有内容则返回空字串
  };
}

export function createPath(location) { // parsePath的逆操作
  const { pathname, search, hash } = location;

  let path = pathname || '/';

  if (search && search !== '?')
    path += search.charAt(0) === '?' ? search : `?${search}`;

  if (hash && hash !== '#') path += hash.charAt(0) === '#' ? hash : `#${hash}`;

  return path;
}
